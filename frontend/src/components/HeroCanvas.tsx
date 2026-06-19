import { useEffect, useRef } from 'react'
import * as THREE from 'three'

interface DisplayWord {
  text: string
  color: string
  textColor: string
}

const displayWords: DisplayWord[] = [
  { text: 'SECURE RAG', color: '#FF7A00', textColor: '#FF9940' },
  { text: 'THREAT_INTEL', color: '#14B8A6', textColor: '#5EEAD4' },
  { text: 'INVESTIGATE', color: '#F5F5F5', textColor: '#FF7A00' },
]

export default function HeroCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const animationRef = useRef<number>(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Scene setup
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1200)
    camera.position.z = 150

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x050505, 1)
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Background plane
    const bgGeometry = new THREE.PlaneGeometry(2000, 2000)
    const bgMaterial = new THREE.MeshBasicMaterial({ color: 0x050505 })
    const bgMesh = new THREE.Mesh(bgGeometry, bgMaterial)
    bgMesh.position.z = -500
    scene.add(bgMesh)

    // Particle systems for each word
    const particleSystems: THREE.Points[] = []
    const shadowSystems: THREE.Points[] = []

    const createTextParticles = (word: DisplayWord, _index: number) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      const dpr = Math.min(window.devicePixelRatio, 2)
      const fontSize = 35 * dpr
      ctx.font = `bold ${fontSize}px "Space Grotesk", sans-serif`
      const metrics = ctx.measureText(word.text)
      canvas.width = metrics.width + 20
      canvas.height = fontSize * 1.4

      ctx.font = `bold ${fontSize}px "Space Grotesk", sans-serif`
      ctx.fillStyle = 'white'
      ctx.textBaseline = 'top'
      ctx.fillText(word.text, 10, fontSize * 0.1)

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const particles: { x: number; y: number; z: number }[] = []
      const shadowParticles: { x: number; y: number; z: number }[] = []

      for (let y = 0; y < canvas.height; y += 2) {
        for (let x = 0; x < canvas.width; x += 2) {
          const idx = (y * canvas.width + x) * 4
          if (imageData.data[idx] > 128) {
            const posX = (x - canvas.width / 2) * 0.7
            const posY = -(y - canvas.height / 2) * 0.7
            particles.push({ x: posX, y: posY - 80, z: 0 })
            shadowParticles.push({ x: posX + 1, y: posY - 81, z: -0.5 })
          }
        }
      }

      // Main particles
      const geometry = new THREE.BufferGeometry()
      const positions = new Float32Array(particles.length * 3)
      const colors = new Float32Array(particles.length * 3)
      const targetPositions = new Float32Array(particles.length * 3)
      const colorObj = new THREE.Color(word.color)

      particles.forEach((p, i) => {
        positions[i * 3] = p.x
        positions[i * 3 + 1] = p.y - 80 // Start below
        positions[i * 3 + 2] = p.z
        targetPositions[i * 3] = p.x
        targetPositions[i * 3 + 1] = p.y
        targetPositions[i * 3 + 2] = p.z
        colors[i * 3] = colorObj.r
        colors[i * 3 + 1] = colorObj.g
        colors[i * 3 + 2] = colorObj.b
      })

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      geometry.setAttribute('targetPosition', new THREE.BufferAttribute(targetPositions, 3))

      const material = new THREE.PointsMaterial({
        size: 1.2,
        vertexColors: true,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })

      const points = new THREE.Points(geometry, material)
      points.visible = false
      scene.add(points)
      particleSystems.push(points)

      // Shadow particles
      const shadowGeometry = new THREE.BufferGeometry()
      const shadowPositions = new Float32Array(shadowParticles.length * 3)
      const shadowColors = new Float32Array(shadowParticles.length * 3)
      const shadowTargets = new Float32Array(shadowParticles.length * 3)
      const shadowColor = new THREE.Color(word.textColor)

      shadowParticles.forEach((p, i) => {
        shadowPositions[i * 3] = p.x
        shadowPositions[i * 3 + 1] = p.y - 80
        shadowPositions[i * 3 + 2] = p.z
        shadowTargets[i * 3] = p.x
        shadowTargets[i * 3 + 1] = p.y
        shadowTargets[i * 3 + 2] = p.z
        shadowColors[i * 3] = shadowColor.r
        shadowColors[i * 3 + 1] = shadowColor.g
        shadowColors[i * 3 + 2] = shadowColor.b
      })

      shadowGeometry.setAttribute('position', new THREE.BufferAttribute(shadowPositions, 3))
      shadowGeometry.setAttribute('color', new THREE.BufferAttribute(shadowColors, 3))
      shadowGeometry.setAttribute('targetPosition', new THREE.BufferAttribute(shadowTargets, 3))

      const shadowMaterial = new THREE.PointsMaterial({
        size: 0.8,
        vertexColors: true,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })

      const shadowPoints = new THREE.Points(shadowGeometry, shadowMaterial)
      shadowPoints.visible = false
      scene.add(shadowPoints)
      shadowSystems.push(shadowPoints)
    }

    displayWords.forEach((word) => createTextParticles(word, 0))

    // Animation state
    let currentWordIndex = 0
    let phase: 'enter' | 'hold' | 'exit' | 'transition' = 'enter'
    let phaseStart = performance.now()
    let glitchActive = false
    let glitchEnd = 0

    const ENTER_DURATION = 800
    const HOLD_DURATION = 1800
    const EXIT_DURATION = 600
    const TRANSITION_DURATION = 300

    function easeOutExpo(t: number): number {
      return t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
    }

    function easeInElastic(t: number): number {
      if (t === 0) return 0
      if (t === 1) return 1
      return -Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI)
    }

    function animate() {
      animationRef.current = requestAnimationFrame(animate)
      const now = performance.now()
      const elapsed = now - phaseStart

      const mainSystem = particleSystems[currentWordIndex]
      const shadowSystem = shadowSystems[currentWordIndex]

      if (!mainSystem || !shadowSystem) {
        renderer.render(scene, camera)
        return
      }

      const mainGeom = mainSystem.geometry as THREE.BufferGeometry
      const shadowGeom = shadowSystem.geometry as THREE.BufferGeometry
      const positions = mainGeom.attributes.position.array as Float32Array
      const targets = mainGeom.attributes.targetPosition.array as Float32Array
      const shadowPos = shadowGeom.attributes.position.array as Float32Array
      const shadowTargets = shadowGeom.attributes.targetPosition.array as Float32Array

      if (phase === 'enter') {
        const progress = Math.min(elapsed / ENTER_DURATION, 1)
        const eased = easeOutExpo(progress)

        mainSystem.visible = true
        shadowSystem.visible = true
        ;(mainSystem.material as THREE.PointsMaterial).opacity = Math.min(progress * 2, 0.9)
        ;(shadowSystem.material as THREE.PointsMaterial).opacity = Math.min(progress * 1.5, 0.4)

        // Check for glitch trigger
        if (progress > 0.3 && progress < 0.7 && Math.random() > 0.85 && !glitchActive) {
          glitchActive = true
          glitchEnd = now + 100 + Math.random() * 150
        }

        if (glitchActive && now < glitchEnd) {
          const jitter = (Math.random() - 0.5) * 6
          for (let i = 0; i < positions.length; i += 3) {
            const t = eased
            positions[i] = targets[i] + jitter * (1 - t)
            positions[i + 1] = targets[i + 1] + (-80 * (1 - t))
            positions[i + 2] = targets[i + 2]
          }
        } else {
          if (glitchActive) glitchActive = false
          for (let i = 0; i < positions.length; i += 3) {
            const t = eased
            positions[i] = targets[i]
            positions[i + 1] = targets[i + 1] + (-80 * (1 - t))
            positions[i + 2] = targets[i + 2]
          }
        }

        // Update shadow positions
        for (let i = 0; i < shadowPos.length; i += 3) {
          const t = eased
          shadowPos[i] = shadowTargets[i]
          shadowPos[i + 1] = shadowTargets[i + 1] + (-80 * (1 - t))
          shadowPos[i + 2] = shadowTargets[i + 2]
        }

        if (progress >= 1) {
          phase = 'hold'
          phaseStart = now
          glitchActive = false
        }
      } else if (phase === 'hold') {
        // Hold phase - subtle breathing
        const breath = Math.sin(now * 0.002) * 0.5
        for (let i = 0; i < positions.length; i += 3) {
          positions[i] = targets[i] + breath
          positions[i + 1] = targets[i + 1]
          positions[i + 2] = targets[i + 2]
        }
        for (let i = 0; i < shadowPos.length; i += 3) {
          shadowPos[i] = shadowTargets[i] + breath * 0.5
          shadowPos[i + 1] = shadowTargets[i + 1]
          shadowPos[i + 2] = shadowTargets[i + 2]
        }

        // Occasional glitch during hold
        if (Math.random() > 0.98) {
          const jitter = (Math.random() - 0.5) * 4
          for (let i = 0; i < positions.length; i += 3) {
            positions[i] = targets[i] + jitter
          }
        }

        if (elapsed >= HOLD_DURATION) {
          phase = 'exit'
          phaseStart = now
          glitchActive = false
        }
      } else if (phase === 'exit') {
        const progress = Math.min(elapsed / EXIT_DURATION, 1)
        const eased = easeInElastic(progress)

        ;(mainSystem.material as THREE.PointsMaterial).opacity = 0.9 * (1 - progress)
        ;(shadowSystem.material as THREE.PointsMaterial).opacity = 0.4 * (1 - progress)

        for (let i = 0; i < positions.length; i += 3) {
          positions[i] = targets[i]
          positions[i + 1] = targets[i + 1] + (eased * 80)
          positions[i + 2] = targets[i + 2]
        }
        for (let i = 0; i < shadowPos.length; i += 3) {
          shadowPos[i] = shadowTargets[i]
          shadowPos[i + 1] = shadowTargets[i + 1] + (eased * 80)
          shadowPos[i + 2] = shadowTargets[i + 2]
        }

        if (progress >= 1) {
          mainSystem.visible = false
          shadowSystem.visible = false
          phase = 'transition'
          phaseStart = now
          currentWordIndex = (currentWordIndex + 1) % displayWords.length
        }
      } else if (phase === 'transition') {
        if (elapsed >= TRANSITION_DURATION) {
          phase = 'enter'
          phaseStart = now
        }
      }

      mainGeom.attributes.position.needsUpdate = true
      shadowGeom.attributes.position.needsUpdate = true
      renderer.render(scene, camera)
    }

    animate()

    // Handle resize
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
      cancelAnimationFrame(animationRef.current)
      renderer.dispose()
      if (container && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
      particleSystems.forEach(p => {
        p.geometry.dispose()
        ;(p.material as THREE.PointsMaterial).dispose()
      })
      shadowSystems.forEach(p => {
        p.geometry.dispose()
        ;(p.material as THREE.PointsMaterial).dispose()
      })
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 1,
      }}
    />
  )
}
