import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { RotateCcw, MousePointer, Hand, Circle } from 'lucide-react'

const stageColors: Record<string, THREE.Color> = {
  recon: new THREE.Color(0x3B82F6),
  exploit: new THREE.Color(0xFF7A00),
  persist: new THREE.Color(0xEAB308),
  exfil: new THREE.Color(0xEF4444),
  c2: new THREE.Color(0x22C55E),
}

const stageLabels = ['recon', 'exploit', 'persist', 'exfil', 'c2']
const stageNames: Record<string, string> = {
  recon: 'Reconnaissance',
  exploit: 'Exploitation',
  persist: 'Persistence',
  exfil: 'Exfiltration',
  c2: 'C2',
}

interface ExplosionData {
  mesh: THREE.Points
  particles: Array<{
    velocity: THREE.Vector3
    life: number
    decay: number
    size: number
    color: THREE.Color
  }>
}

interface RippleData {
  mesh: THREE.Mesh
  age: number
  maxAge: number
}

export default function AttackGraph() {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const explosionsRef = useRef<ExplosionData[]>([])
  const ripplesRef = useRef<RippleData[]>([])
  const animRef = useRef<number>(0)
  const [activeStages, setActiveStages] = useState<Set<string>>(new Set(stageLabels))
  const [nodeCount] = useState(47)
  const [edgeCount] = useState(89)

  const createTextParticles = useCallback((scene: THREE.Scene, text: string, color: string, yPos: number) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const fontSize = 30
    ctx.font = `bold ${fontSize}px "Space Grotesk", sans-serif`
    const metrics = ctx.measureText(text)
    canvas.width = metrics.width + 10
    canvas.height = fontSize * 1.4

    ctx.font = `bold ${fontSize}px "Space Grotesk", sans-serif`
    ctx.fillStyle = 'white'
    ctx.textBaseline = 'top'
    ctx.fillText(text, 5, fontSize * 0.1)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const particles: { x: number; y: number; z: number }[] = []

    for (let y = 0; y < canvas.height; y += 2) {
      for (let x = 0; x < canvas.width; x += 2) {
        const idx = (y * canvas.width + x) * 4
        if (imageData.data[idx] > 128) {
          particles.push({
            x: (x - canvas.width / 2) * 0.5,
            y: (canvas.height / 2 - y) * 0.5 + yPos,
            z: 0,
          })
        }
      }
    }

    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(particles.length * 3)
    const colors = new Float32Array(particles.length * 3)
    const c = new THREE.Color(color)

    particles.forEach((p, i) => {
      positions[i * 3] = p.x
      positions[i * 3 + 1] = p.y
      positions[i * 3 + 2] = p.z
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    })

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const material = new THREE.PointsMaterial({
      size: 1.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })

    const points = new THREE.Points(geometry, material)
    scene.add(points)
    return points
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Scene
    const scene = new THREE.Scene()
    sceneRef.current = scene
    scene.fog = new THREE.Fog(0x050505, 200, 800)

    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1200)
    cameraRef.current = camera
    camera.position.z = 180

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    rendererRef.current = renderer
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x050505, 1)
    container.appendChild(renderer.domElement)

    // Background
    const bgGeo = new THREE.PlaneGeometry(3000, 3000)
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x050505 })
    const bgMesh = new THREE.Mesh(bgGeo, bgMat)
    bgMesh.position.z = -600
    scene.add(bgMesh)

    // Create text particles for each stage
    const textPositions: Record<string, THREE.Points> = {}
    const yPositions = [80, 40, 0, -40, -80]
    stageLabels.forEach((stage, i) => {
      const color = '#' + stageColors[stage].getHexString()
      textPositions[stage] = createTextParticles(scene, stage.toUpperCase(), color, yPositions[i])
    })

    // Create attack nodes (small glowing circles)
    const nodePositions: THREE.Vector3[] = []
    for (let i = 0; i < 47; i++) {
      const angle = (i / 47) * Math.PI * 2
      const radius = 60 + Math.random() * 80
      const x = Math.cos(angle) * radius + (Math.random() - 0.5) * 40
      const y = Math.sin(angle) * radius * 0.6 + (Math.random() - 0.5) * 40
      const z = (Math.random() - 0.5) * 40
      nodePositions.push(new THREE.Vector3(x, y, z))

      const nodeGeo = new THREE.SphereGeometry(1.5 + Math.random() * 2, 8, 8)
      const nodeColor = stageColors[stageLabels[i % 5]]
      const nodeMat = new THREE.MeshBasicMaterial({
        color: nodeColor,
        transparent: true,
        opacity: 0.6,
      })
      const node = new THREE.Mesh(nodeGeo, nodeMat)
      node.position.set(x, y, z)
      scene.add(node)
    }

    // Create edges (attack paths)
    for (let i = 0; i < 89; i++) {
      const from = nodePositions[i % nodePositions.length]
      const to = nodePositions[(i * 7 + 13) % nodePositions.length]

      const edgeGeo = new THREE.BufferGeometry().setFromPoints([from, to])
      const edgeMat = new THREE.LineBasicMaterial({
        color: 0xD4A574,
        transparent: true,
        opacity: 0.15,
      })
      const edge = new THREE.Line(edgeGeo, edgeMat)
      scene.add(edge)
    }

    // Mouse tracking
    const mouse = new THREE.Vector2()
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    }

    const createExplosion = (position: THREE.Vector3, stage: string) => {
      const color = stageColors[stage] || stageColors['exploit']
      const particleCount = 200
      const geometry = new THREE.BufferGeometry()
      const positions = new Float32Array(particleCount * 3)
      const particles: ExplosionData['particles'] = []

      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3
        positions[i3] = position.x
        positions[i3 + 1] = position.y
        positions[i3 + 2] = position.z

        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(2 * Math.random() - 1)
        const speed = 2 + Math.random() * 3

        particles.push({
          velocity: new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta) * speed,
            Math.sin(phi) * Math.sin(theta) * speed,
            Math.cos(phi) * speed
          ),
          life: 1.0,
          decay: 0.005 + Math.random() * 0.01,
          size: 1.5 + Math.random() * 2,
          color: color,
        })
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      const material = new THREE.PointsMaterial({
        size: 2,
        color: color,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })

      const mesh = new THREE.Points(geometry, material)
      scene.add(mesh)
      explosionsRef.current.push({ mesh, particles })
    }

    const createRipple = (position: THREE.Vector3) => {
      const geometry = new THREE.RingGeometry(0.1, 0.5, 32)
      const material = new THREE.MeshBasicMaterial({
        color: 0xFF7A00,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
      })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.copy(position)
      mesh.lookAt(camera.position)
      scene.add(mesh)
      ripplesRef.current.push({ mesh, age: 0, maxAge: 60 })
    }

    const handleClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1

      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera)

      const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
      const target = new THREE.Vector3()
      raycaster.ray.intersectPlane(planeZ, target)

      if (target) {
        // Determine stage based on Y position
        const stages = Object.keys(stageColors)
        const stageIndex = Math.floor(Math.abs(target.y + 80) / 40) % stages.length
        const stage = stages[stageIndex] || 'exploit'
        createExplosion(target, stage)

        // Camera shake
        const originalZ = camera.position.z
        let shakeIntensity = 8
        const shake = () => {
          if (shakeIntensity > 0.5) {
            camera.position.x = (Math.random() - 0.5) * shakeIntensity
            camera.position.y = (Math.random() - 0.5) * shakeIntensity
            shakeIntensity *= 0.9
            requestAnimationFrame(shake)
          } else {
            camera.position.x = 0
            camera.position.y = 0
            camera.position.z = originalZ
          }
        }
        shake()
      }
    }

    const handleRightClick = (e: MouseEvent) => {
      e.preventDefault()
      const rect = container.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1

      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera)

      const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
      const target = new THREE.Vector3()
      raycaster.ray.intersectPlane(planeZ, target)

      if (target) {
        createRipple(target)
      }
    }

    container.addEventListener('mousemove', handleMouseMove)
    container.addEventListener('click', handleClick)
    container.addEventListener('contextmenu', handleRightClick)

    // Animation loop
    const animate = () => {
      animRef.current = requestAnimationFrame(animate)

      // Subtle camera orbit
      const time = performance.now() * 0.0002
      camera.position.x = Math.sin(time) * 5
      camera.position.y = Math.cos(time * 0.7) * 3
      camera.lookAt(0, 0, 0)

      // Update explosions
      for (let i = explosionsRef.current.length - 1; i >= 0; i--) {
        const exp = explosionsRef.current[i]
        const positions = exp.mesh.geometry.attributes.position.array as Float32Array
        let allDead = true

        for (let j = 0; j < exp.particles.length; j++) {
          const p = exp.particles[j]
          if (p.life <= 0) continue
          allDead = false

          p.velocity.y -= 0.15 // gravity
          positions[j * 3] += p.velocity.x * 0.016
          positions[j * 3 + 1] += p.velocity.y * 0.016
          positions[j * 3 + 2] += p.velocity.z * 0.016
          p.life -= p.decay
        }

        ;(exp.mesh.material as THREE.PointsMaterial).opacity = Math.max(0, exp.particles[0]?.life || 0)
        exp.mesh.geometry.attributes.position.needsUpdate = true

        if (allDead) {
          scene.remove(exp.mesh)
          exp.mesh.geometry.dispose()
          ;(exp.mesh.material as THREE.PointsMaterial).dispose()
          explosionsRef.current.splice(i, 1)
        }
      }

      // Update ripples
      for (let i = ripplesRef.current.length - 1; i >= 0; i--) {
        const rip = ripplesRef.current[i]
        rip.age++
        const scale = 1 + (rip.age / rip.maxAge) * 50
        rip.mesh.scale.set(scale, scale, 1)
        ;(rip.mesh.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - rip.age / rip.maxAge)

        if (rip.age >= rip.maxAge) {
          scene.remove(rip.mesh)
          rip.mesh.geometry.dispose()
          ;(rip.mesh.material as THREE.MeshBasicMaterial).dispose()
          ripplesRef.current.splice(i, 1)
        }
      }

      renderer.render(scene, camera)
    }

    animate()

    const handleResize = () => {
      if (!container) return
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      container.removeEventListener('mousemove', handleMouseMove)
      container.removeEventListener('click', handleClick)
      container.removeEventListener('contextmenu', handleRightClick)
      cancelAnimationFrame(animRef.current)

      explosionsRef.current.forEach(exp => {
        scene.remove(exp.mesh)
        exp.mesh.geometry.dispose()
        ;(exp.mesh.material as THREE.PointsMaterial).dispose()
      })
      explosionsRef.current = []

      ripplesRef.current.forEach(rip => {
        scene.remove(rip.mesh)
        rip.mesh.geometry.dispose()
        ;(rip.mesh.material as THREE.MeshBasicMaterial).dispose()
      })
      ripplesRef.current = []

      renderer.dispose()
      if (container && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [createTextParticles])

  const toggleStage = (stage: string) => {
    setActiveStages(prev => {
      const next = new Set(prev)
      if (next.has(stage)) next.delete(stage)
      else next.add(stage)
      return next
    })
  }

  const resetView = () => {
    setActiveStages(new Set(stageLabels))
    if (cameraRef.current) {
      cameraRef.current.position.set(0, 0, 180)
      cameraRef.current.lookAt(0, 0, 0)
    }
  }

  return (
    <div className="relative w-full h-full">
      {/* Canvas Container */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* HUD Overlay */}
      {/* Top Left */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <h2 className="text-lg font-display font-bold text-sr-text">Attack Graph: Campaign Alpha</h2>
        <p className="text-xs font-mono text-sr-text-secondary mt-0.5">{nodeCount} nodes, {edgeCount} edges</p>
      </div>

      {/* Top Right - Legend */}
      <div className="absolute top-4 right-4 z-10 bg-sr-surface/80 backdrop-blur-sm border border-sr-border rounded-lg p-3">
        <div className="text-[10px] text-sr-text-secondary uppercase tracking-wider mb-2">Kill Chain Stages</div>
        <div className="space-y-1.5">
          {stageLabels.map(stage => (
            <div key={stage} className="flex items-center gap-2">
              <Circle
                size={8}
                fill={'#' + stageColors[stage].getHexString()}
                color={'#' + stageColors[stage].getHexString()}
              />
              <span className="text-[11px] text-sr-text-secondary">{stageNames[stage]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Left - Controls */}
      <div className="absolute bottom-4 left-4 z-10 bg-sr-surface/80 backdrop-blur-sm border border-sr-border rounded-lg p-3">
        <div className="text-[10px] text-sr-text-secondary uppercase tracking-wider mb-2">Stage Filter</div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {stageLabels.map(stage => (
            <button
              key={stage}
              onClick={() => toggleStage(stage)}
              className={`px-2 py-1 rounded text-[10px] font-medium transition-colors border ${
                activeStages.has(stage)
                  ? 'border-transparent text-sr-text'
                  : 'border-sr-border text-sr-text-tertiary opacity-50'
              }`}
              style={{
                background: activeStages.has(stage) ? '#' + stageColors[stage].getHexString() + '30' : 'transparent',
                color: activeStages.has(stage) ? '#' + stageColors[stage].getHexString() : undefined,
              }}
            >
              {stageNames[stage]}
            </button>
          ))}
        </div>
        <button
          onClick={resetView}
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-sr-elevated border border-sr-border text-[10px] text-sr-text-secondary hover:text-sr-text transition-colors"
        >
          <RotateCcw size={10} /> Reset View
        </button>
      </div>

      {/* Bottom Right - Controls Hint */}
      <div className="absolute bottom-4 right-4 z-10 bg-sr-surface/80 backdrop-blur-sm border border-sr-border rounded-lg p-3">
        <div className="text-[10px] text-sr-text-secondary uppercase tracking-wider mb-2">Controls</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[11px] text-sr-text-secondary">
            <MousePointer size={10} /> Click to explode
          </div>
          <div className="flex items-center gap-2 text-[11px] text-sr-text-secondary">
            <Hand size={10} /> Right-click for ripple
          </div>
        </div>
      </div>

      {/* Mini Map */}
      <div className="absolute bottom-4 left-[280px] z-10 w-[200px] h-[130px] bg-sr-surface/80 backdrop-blur-sm border border-sr-border rounded-lg overflow-hidden">
        <div className="absolute top-1.5 left-2 text-[9px] text-sr-text-tertiary uppercase">Overview</div>
        <svg width="200" height="130" className="opacity-60">
          {/* Edges */}
          {Array.from({ length: 30 }, (_, i) => {
            const x1 = 30 + Math.sin(i * 2.1) * 70
            const y1 = 35 + Math.cos(i * 1.7) * 40
            const x2 = 30 + Math.sin((i * 7 + 13) * 2.1) * 70
            const y2 = 35 + Math.cos((i * 7 + 13) * 1.7) * 40
            return (
              <line key={i} x1={x1 + 70} y1={y1 + 30} x2={x2 + 70} y2={y2 + 30} stroke="#D4A574" strokeWidth="0.5" opacity="0.3" />
            )
          })}
          {/* Nodes */}
          {Array.from({ length: 20 }, (_, i) => {
            const x = 100 + Math.sin(i * 2.1) * 70
            const y = 65 + Math.cos(i * 1.7) * 40
            const stage = stageLabels[i % 5]
            return (
              <circle key={i} cx={x} cy={y} r="2" fill={'#' + stageColors[stage].getHexString()} opacity="0.8" />
            )
          })}
        </svg>
      </div>
    </div>
  )
}
