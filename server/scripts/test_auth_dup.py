import os
import sys
import io
import uuid

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app import create_app

def test_auth_and_dup():
    app = create_app()
    client = app.test_client()
    
    # 1. Test Login with Admin
    print("Testing login...")
    response = client.post('/auth/login', json={"username": "admin", "password": "admin"})
    assert response.status_code == 200
    token = response.json.get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Test Upload and Duplicate Check
    print("Testing upload and duplicate prevention...")
    unique_content = f"This is a test log file content {uuid.uuid4()}\nWith multiple lines".encode()

    data = {"file": (io.BytesIO(unique_content), "test_log.txt")}
    res1 = client.post('/upload', headers=headers, data=data, content_type='multipart/form-data')
    assert res1.status_code == 200, f"Expected 200, got {res1.status_code}: {res1.json}"
    
    # Same file again — should now be flagged as duplicate
    data2 = {"file": (io.BytesIO(unique_content), "test_log.txt")}
    res2 = client.post('/upload', headers=headers, data=data2, content_type='multipart/form-data')
    assert res2.status_code == 409
    assert "File already ingested" in res2.json.get("error")
    
    # 3. Test RBAC Analyst Creation and Roles
    print("Testing RBAC (Analyst creation and role enforcement)...")
    res_reg = client.post('/auth/register', headers=headers, json={
        "username": "analyst1", "password": "password123", "role": "ANALYST"
    })
    assert res_reg.status_code in [201, 409]  # 409 if already exists
    
    # Login as analyst
    res_login_an = client.post('/auth/login', json={"username": "analyst1", "password": "password123"})
    assert res_login_an.status_code == 200
    an_token = res_login_an.json.get("access_token")
    an_headers = {"Authorization": f"Bearer {an_token}"}
    
    # Analyst shouldn't be able to upload
    data3 = {"file": (io.BytesIO(b"Some new content"), "new_log.txt")}
    res_up_an = client.post('/upload', headers=an_headers, data=data3, content_type='multipart/form-data')
    assert res_up_an.status_code == 403
    
    print("All tests passed successfully!")

if __name__ == "__main__":
    test_auth_and_dup()