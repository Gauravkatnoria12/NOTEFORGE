import React, { useRef, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Float, MeshDistortMaterial } from '@react-three/drei'
import * as THREE from 'three'

// Morphing wireframe crystal that drifts with mouse coordinates
function InteractiveCrystal() {
  const meshRef = useRef()
  const [hovered, setHovered] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const mouse = useRef({ x: 0, y: 0 })

  // Detect system dark mode
  useEffect(() => {
    const dmQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDarkMode(dmQuery.matches)
    const handler = (e) => setIsDarkMode(e.matches)
    dmQuery.addEventListener('change', handler)
    
    const handleMouseMove = (e) => {
      // Normalize mouse coordinates (-1 to 1)
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1
    }
    
    window.addEventListener('mousemove', handleMouseMove)
    return () => {
      dmQuery.removeEventListener('change', handler)
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  useFrame((state) => {
    if (!meshRef.current) return
    
    // Rotate slowly
    meshRef.current.rotation.x += 0.003
    meshRef.current.rotation.y += 0.005

    // Drift mesh towards mouse coordinates
    const targetX = mouse.current.x * 1.5
    const targetY = mouse.current.y * 1.5
    
    meshRef.current.position.x = THREE.MathUtils.lerp(meshRef.current.position.x, targetX, 0.05)
    meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, targetY, 0.05)

    // Pulsate scale on hover
    const targetScale = hovered ? 1.4 : 1.1
    meshRef.current.scale.x = THREE.MathUtils.lerp(meshRef.current.scale.x, targetScale, 0.1)
    meshRef.current.scale.y = THREE.MathUtils.lerp(meshRef.current.scale.y, targetScale, 0.1)
    meshRef.current.scale.z = THREE.MathUtils.lerp(meshRef.current.scale.z, targetScale, 0.1)
  })

  // Color selection based on dark mode: strict monochrome linework
  const lineColor = isDarkMode ? '#eaeaea' : '#111111'

  return (
    <Float speed={2.5} rotationIntensity={1.2} floatIntensity={1.5}>
      <mesh
        ref={meshRef}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        {/* Icosahedron geometry gives neat geometric linework */}
        <icosahedronGeometry args={[2, 2]} />
        <MeshDistortMaterial
          color={lineColor}
          distort={0.35}
          speed={hovered ? 3.5 : 1.5}
          wireframe={true}
          roughness={0.1}
          metalness={0.8}
        />
      </mesh>
    </Float>
  )
}

export default function Canvas3D() {
  return (
    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden opacity-30 dark:opacity-20">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 45 }}
        eventSource={document.getElementById('root')}
        className="pointer-events-auto"
      >
        <ambientLight intensity={1.5} />
        <pointLight position={[10, 10, 10]} intensity={1.5} />
        <InteractiveCrystal />
      </Canvas>
    </div>
  )
}
