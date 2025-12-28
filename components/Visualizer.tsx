import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { VisualizerMode } from '../types';

interface VisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  mode: VisualizerMode;
}

const Visualizer: React.FC<VisualizerProps> = ({ analyser, isPlaying, mode }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const animationRef = useRef<number>();
  
  // Store previous frame data for smoothing (linear interpolation)
  const prevDataRef = useRef<Float32Array>(new Float32Array(0));

  useEffect(() => {
    if (!analyser || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth || 0;
    const height = svgRef.current.clientHeight || 0;
    
    // Clear previous elements when mode or dimensions change
    svg.selectAll("*").remove();

    // Configuration
    // High FFT size for detailed frequency analysis
    const fftSize = 1024; 
    analyser.fftSize = fftSize; 
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    // Initialize smoothing buffer
    if (prevDataRef.current.length !== bufferLength) {
        prevDataRef.current = new Float32Array(bufferLength).fill(0);
    }

    // Color Scales
    const colorScale = d3.scaleSequential()
        .domain([0, bufferLength * 0.6])
        .interpolator(d3.interpolateCool);

    const renderFrame = () => {
      if (!isPlaying && mode !== VisualizerMode.CIRCLE && mode !== VisualizerMode.SPIRAL && mode !== VisualizerMode.WAVE) { 
         if (!isPlaying) {
             cancelAnimationFrame(animationRef.current!);
             return;
         }
      }
      
      // 1. Get Raw Data
      analyser.getByteFrequencyData(dataArray);

      // 2. Smooth Data
      // Adjust smoothing based on mode
      let smoothingFactor = 0.3; // Default smooth
      if (mode === VisualizerMode.SPIRAL) smoothingFactor = 0.8; 
      if (mode === VisualizerMode.WAVE) smoothingFactor = 0.5;

      const smoothData = new Float32Array(bufferLength);
      
      for (let i = 0; i < bufferLength; i++) {
          const target = isPlaying ? dataArray[i] : 0;
          prevDataRef.current[i] += (target - prevDataRef.current[i]) * smoothingFactor;
          smoothData[i] = prevDataRef.current[i];
      }

      const time = Date.now() / 1000;
      const centerX = width / 2;
      const centerY = height / 2;

      // 3. Render Modes
      if (mode === VisualizerMode.BARS) {
        const barCount = 64; 
        const step = Math.floor((bufferLength * 0.7) / barCount);
        const visualData: { val: number, idx: number }[] = [];
        
        for (let i = 0; i < barCount; i++) {
          let sum = 0;
          for (let j = 0; j < step; j++) sum += smoothData[i * step + j];
          visualData.push({ val: sum / step, idx: i * step });
        }

        const xScale = d3.scaleBand()
          .domain(d3.range(visualData.length).map(String))
          .range([0, width])
          .padding(0.25);

        const yScale = d3.scaleLinear()
          .domain([0, 255])
          .range([height, height * 0.1]); 

        const bars = svg.selectAll("rect").data(visualData);

        bars.enter()
          .append("rect")
          .merge(bars as any)
          .attr("x", (d, i) => xScale(String(i)) || 0)
          .attr("y", d => yScale(d.val))
          .attr("width", xScale.bandwidth())
          .attr("height", d => Math.max(4, height - yScale(d.val))) 
          .attr("fill", (d) => colorScale(d.idx))
          .attr("rx", 4)
          .attr("opacity", 0.9);

        bars.exit().remove();
      
      } else if (mode === VisualizerMode.WAVE) {
        // "Spiraling RGB Mandala" - Petals spiral outward, growing and fading
        const numPetals = 16; // 16 petals for full flower
        const maxMandalaSize = Math.min(width, height) * 0.5;
        const petalSize = 80;

        // Calculate overall energy for pulsing
        let totalEnergy = 0;
        for(let i = 0; i < 100; i++) totalEnergy += smoothData[i];
        totalEnergy = totalEnergy / 100 / 255;

        // RGB color cycling
        const hue = (time * 30) % 360;

        // Spiral effect: size grows over time, then resets
        // This creates the "uncurling" effect
        const spiralPhase = (time * 20) % 100; // 0-100 cycle
        const spiralScale = spiralPhase / 100; // 0 to 1

        // Create all petals
        const allPetals = [];
        for (let petal = 0; petal < numPetals; petal++) {
            const petalAngle = (petal / numPetals) * Math.PI * 2;

            // Each petal uses different frequency range
            const freqStart = Math.floor((petal / numPetals) * (bufferLength * 0.6));
            const petalData = Array.from(smoothData).slice(freqStart, freqStart + petalSize);

            // Mirror data for symmetrical petal
            const mirroredData = [...petalData, ...petalData.slice().reverse()];

            // Petal-specific energy
            let petalEnergy = 0;
            for(let i = 0; i < petalData.length; i++) petalEnergy += petalData[i];
            petalEnergy = petalEnergy / petalData.length / 255;

            // Each petal spirals outward at a different phase
            // Offset by petal index so they spiral sequentially
            const petalSpiralPhase = (spiralPhase + (petal * 6.25)) % 100; // Offset each petal
            const petalSpiralScale = petalSpiralPhase / 100;

            // Size grows from center to max, then resets
            const currentSize = maxMandalaSize * petalSpiralScale * (1.0 + petalEnergy * 0.3);

            // Fade out as it gets larger (creates the "moving to end" effect)
            const fadeOut = 1.0 - (petalSpiralScale * 0.5);

            // Create points for this petal
            const points = mirroredData.map((val, i) => {
                const angle = petalAngle + ((i / mirroredData.length) - 0.5) * 0.4;
                const radius = currentSize * 0.3 + (val / 255) * (currentSize * 0.7);
                return {
                    x: centerX + Math.cos(angle) * radius,
                    y: centerY + Math.sin(angle) * radius,
                    val
                };
            });

            // Create path for petal
            const pathLine = d3.line<{x: number, y: number, val: number}>()
                .x(d => d.x)
                .y(d => d.y)
                .curve(d3.curveCatmullRomClosed);

            const pathData = pathLine(points);

            allPetals.push({
                petal,
                pathData,
                hue: (hue + petal * (360 / numPetals)) % 360,
                opacity: (0.7 + petalEnergy * 0.25) * fadeOut,
                scale: petalSpiralScale
            });
        }

        // Render all petals
        const petalGroups = svg.selectAll(".wave-petal").data(allPetals, (d: any) => d.petal);

        const groupsEnter = petalGroups.enter()
            .append("g")
            .attr("class", "wave-petal");

        const groups = groupsEnter.merge(petalGroups as any);

        // Fill
        const pathFill = groups.selectAll("path.fill").data((d: any) => [d]);
        pathFill.enter().append("path")
            .attr("class", "fill")
            .merge(pathFill as any)
            .attr("d", (d: any) => d.pathData)
            .attr("fill", (d: any) => `hsl(${d.hue}, 90%, 60%)`)
            .attr("opacity", (d: any) => d.opacity)
            .attr("stroke", "none");

        // Bright stroke outline
        const pathStroke = groups.selectAll("path.stroke").data((d: any) => [d]);
        pathStroke.enter().append("path")
            .attr("class", "stroke")
            .merge(pathStroke as any)
            .attr("d", (d: any) => d.pathData)
            .attr("fill", "none")
            .attr("stroke", (d: any) => `hsl(${d.hue}, 95%, 85%)`)
            .attr("stroke-width", 2)
            .attr("opacity", (d: any) => d.opacity * 0.9);

        petalGroups.exit().remove();

      } else if (mode === VisualizerMode.CIRCLE) {
        const points = 80; 
        const radiusInner = Math.min(width, height) / 4.5;
        const maxBarHeight = Math.min(width, height) / 3;
        
        let bassSum = 0;
        for(let i=0; i<10; i++) bassSum += smoothData[i];
        const bassAvg = bassSum / 10;
        const currentRadius = radiusInner + (bassAvg / 255) * 15;

        const visualData: { val: number, idx: number }[] = [];
        const step = Math.floor((bufferLength * 0.6) / points); 
        
        for (let i = 0; i < points; i++) {
             // Mirror half-way for symmetry
             const spectrumIndex = i < points / 2 
                ? i * step 
                : (points - 1 - i) * step;
             visualData.push({ val: smoothData[spectrumIndex], idx: spectrumIndex });
        }

        const center = svg.selectAll(".core").data([bassAvg]);
        center.enter().append("circle")
            .attr("class", "core")
            .attr("cx", centerX)
            .attr("cy", centerY)
            .merge(center as any)
            .attr("r", currentRadius * 0.9)
            .attr("fill", "#000")
            .attr("stroke", d3.interpolateCool(0.2))
            .attr("stroke-width", 2)
            .attr("opacity", 0.8);
        center.exit().remove();

        const bars = svg.selectAll("line").data(visualData);
        const angleStep = (Math.PI * 2) / points;
        
        bars.enter()
            .append("line")
            .merge(bars as any)
            .attr("x1", (d, i) => centerX + Math.cos(i * angleStep - Math.PI/2) * (currentRadius + 5))
            .attr("y1", (d, i) => centerY + Math.sin(i * angleStep - Math.PI/2) * (currentRadius + 5))
            .attr("x2", (d, i) => {
                const h = (d.val / 255) * maxBarHeight;
                return centerX + Math.cos(i * angleStep - Math.PI/2) * (currentRadius + 5 + h);
            })
            .attr("y2", (d, i) => {
                const h = (d.val / 255) * maxBarHeight;
                return centerY + Math.sin(i * angleStep - Math.PI/2) * (currentRadius + 5 + h);
            })
            .attr("stroke", (d) => colorScale(d.idx))
            .attr("stroke-width", (Math.PI * 2 * radiusInner) / points * 0.6)
            .attr("stroke-linecap", "round");
        bars.exit().remove();

      } else if (mode === VisualizerMode.SPIRAL) {
        // Dual Vortex
        const points = 350;
        const angleStep = 2.39996; // Golden angle
        const spacing = Math.min(width, height) / 30;
    
        const spiralData = [];
        // Map mostly low-mid frequencies
        const freqRange = Math.floor(bufferLength * 0.5);

        for (let i = 0; i < points; i++) {
            const val = smoothData[i % freqRange];
            
            // Vortex 1: Cyan/Blue
            spiralData.push({ 
                i, 
                val, 
                x: centerX + (spacing * Math.sqrt(i) * Math.cos(i * angleStep + time * 0.2)),
                y: centerY + (spacing * Math.sqrt(i) * Math.sin(i * angleStep + time * 0.2)),
                color: d3.interpolateCool(i / points),
                r: 2 + (val / 255) * 8
            });
            // Vortex 2: Magenta/Orange (Opposite rotation)
            spiralData.push({ 
                i, 
                val, 
                x: centerX + (spacing * Math.sqrt(i) * Math.cos(-i * angleStep - time * 0.3)),
                y: centerY + (spacing * Math.sqrt(i) * Math.sin(-i * angleStep - time * 0.3)),
                color: d3.interpolateWarm(i / points),
                r: 2 + (val / 255) * 6
            });
        }
        
        const circles = svg.selectAll("circle").data(spiralData);
        
        circles.enter()
            .append("circle")
            .merge(circles as any)
            .attr("cx", d => d.x)
            .attr("cy", d => d.y)
            .attr("r", d => d.r)
            .attr("fill", d => d.color)
            .attr("opacity", d => 0.4 + (d.val / 512));
        circles.exit().remove();

      } else if (mode === VisualizerMode.PARTICLES) {
        // Floating particles that react to audio
        const particleCount = 150;
        const particles = [];

        // Calculate overall energy
        let totalEnergy = 0;
        for(let i = 0; i < 50; i++) totalEnergy += smoothData[i];
        totalEnergy = (totalEnergy / 50 / 255);

        for (let i = 0; i < particleCount; i++) {
          const freqIndex = Math.floor((i / particleCount) * bufferLength * 0.6);
          const val = smoothData[freqIndex];
          const energy = val / 255;

          // Particle position with wave motion
          const baseX = (i / particleCount) * width;
          const waveOffset = Math.sin(time * 2 + i * 0.1) * 50 * energy;
          const x = baseX + waveOffset;
          const y = centerY + Math.sin(time + i * 0.15) * (height * 0.3) * (0.5 + energy * 0.5);

          particles.push({
            x,
            y,
            r: 2 + energy * 12,
            color: colorScale(freqIndex),
            opacity: 0.3 + energy * 0.6
          });
        }

        const dots = svg.selectAll("circle").data(particles);
        dots.enter()
          .append("circle")
          .merge(dots as any)
          .attr("cx", d => d.x)
          .attr("cy", d => d.y)
          .attr("r", d => d.r)
          .attr("fill", d => d.color)
          .attr("opacity", d => d.opacity);
        dots.exit().remove();

      } else if (mode === VisualizerMode.SPECTRUM) {
        // Classic spectrum analyzer with gradient
        const barCount = 96;
        const step = Math.floor((bufferLength * 0.8) / barCount);
        const visualData: { val: number, idx: number }[] = [];

        for (let i = 0; i < barCount; i++) {
          let sum = 0;
          for (let j = 0; j < step; j++) sum += smoothData[i * step + j];
          visualData.push({ val: sum / step, idx: i * step });
        }

        const xScale = d3.scaleBand()
          .domain(d3.range(visualData.length).map(String))
          .range([0, width])
          .padding(0.15);

        const yScale = d3.scaleLinear()
          .domain([0, 255])
          .range([height, 0]);

        // Create gradient
        const gradient = svg.selectAll("defs").data([0]);
        const defsEnter = gradient.enter().append("defs");
        const defs = defsEnter.merge(gradient as any);

        const gradientData = defs.selectAll("linearGradient").data([0]);
        const gradEnter = gradientData.enter().append("linearGradient")
          .attr("id", "spectrum-gradient")
          .attr("x1", "0%")
          .attr("y1", "100%")
          .attr("x2", "0%")
          .attr("y2", "0%");

        gradEnter.append("stop")
          .attr("offset", "0%")
          .attr("stop-color", "#06b6d4")
          .attr("stop-opacity", 1);

        gradEnter.append("stop")
          .attr("offset", "50%")
          .attr("stop-color", "#8b5cf6")
          .attr("stop-opacity", 1);

        gradEnter.append("stop")
          .attr("offset", "100%")
          .attr("stop-color", "#ec4899")
          .attr("stop-opacity", 1);

        const bars = svg.selectAll("rect.spectrum-bar").data(visualData);

        bars.enter()
          .append("rect")
          .attr("class", "spectrum-bar")
          .merge(bars as any)
          .attr("x", (d, i) => xScale(String(i)) || 0)
          .attr("y", d => yScale(d.val))
          .attr("width", xScale.bandwidth())
          .attr("height", d => Math.max(2, height - yScale(d.val)))
          .attr("fill", "url(#spectrum-gradient)")
          .attr("rx", 2)
          .attr("opacity", 0.9);

        bars.exit().remove();

      } else if (mode === VisualizerMode.RINGS) {
        // Concentric rings pulsing outward
        const ringCount = 12;
        const rings = [];

        for (let i = 0; i < ringCount; i++) {
          const freqStart = Math.floor((i / ringCount) * bufferLength * 0.5);
          let ringEnergy = 0;
          for (let j = 0; j < 20; j++) {
            ringEnergy += smoothData[freqStart + j] || 0;
          }
          ringEnergy = ringEnergy / 20 / 255;

          const baseRadius = ((i + 1) / ringCount) * Math.min(width, height) * 0.45;
          const pulse = Math.sin(time * 3 + i * 0.5) * 10;
          const radius = baseRadius + pulse + ringEnergy * 40;

          rings.push({
            r: radius,
            energy: ringEnergy,
            color: colorScale(freqStart),
            index: i
          });
        }

        const circles = svg.selectAll("circle").data(rings);
        circles.enter()
          .append("circle")
          .merge(circles as any)
          .attr("cx", centerX)
          .attr("cy", centerY)
          .attr("r", d => d.r)
          .attr("fill", "none")
          .attr("stroke", d => d.color)
          .attr("stroke-width", d => 2 + d.energy * 6)
          .attr("opacity", d => 0.4 + d.energy * 0.5);
        circles.exit().remove();

      } else if (mode === VisualizerMode.DNA) {
        // Double helix DNA structure
        const points = 120;
        const helixData = [];
        const helixRadius = Math.min(width, height) * 0.15;
        const helixLength = height * 0.8;
        const startY = (height - helixLength) / 2;

        for (let i = 0; i < points; i++) {
          const t = i / points;
          const y = startY + t * helixLength;
          const angle1 = t * Math.PI * 6 + time;
          const angle2 = t * Math.PI * 6 + time + Math.PI;

          const freqIndex = Math.floor(t * bufferLength * 0.6);
          const val = smoothData[freqIndex];
          const energy = val / 255;

          // Strand 1 (left helix)
          helixData.push({
            x: centerX + Math.cos(angle1) * helixRadius * (1 + energy * 0.3),
            y,
            r: 3 + energy * 5,
            color: d3.interpolateCool(t),
            type: 'strand1',
            energy
          });

          // Strand 2 (right helix)
          helixData.push({
            x: centerX + Math.cos(angle2) * helixRadius * (1 + energy * 0.3),
            y,
            r: 3 + energy * 5,
            color: d3.interpolateWarm(t),
            type: 'strand2',
            energy
          });

          // Connecting bar (every 8th point)
          if (i % 8 === 0) {
            const x1 = centerX + Math.cos(angle1) * helixRadius * (1 + energy * 0.3);
            const x2 = centerX + Math.cos(angle2) * helixRadius * (1 + energy * 0.3);
            helixData.push({
              x: x1,
              y,
              x2,
              y2: y,
              type: 'connector',
              color: d3.interpolateViridis(t),
              energy
            });
          }
        }

        // Draw circles for helix strands
        const circles = svg.selectAll("circle.dna-strand").data(helixData.filter(d => d.type !== 'connector'));
        circles.enter()
          .append("circle")
          .attr("class", "dna-strand")
          .merge(circles as any)
          .attr("cx", d => d.x)
          .attr("cy", d => d.y)
          .attr("r", d => d.r)
          .attr("fill", d => d.color)
          .attr("opacity", d => 0.7 + d.energy * 0.3);
        circles.exit().remove();

        // Draw lines for connectors
        const connectors = svg.selectAll("line.dna-connector").data(helixData.filter(d => d.type === 'connector'));
        connectors.enter()
          .append("line")
          .attr("class", "dna-connector")
          .merge(connectors as any)
          .attr("x1", d => d.x)
          .attr("y1", d => d.y)
          .attr("x2", d => d.x2)
          .attr("y2", d => d.y2)
          .attr("stroke", d => d.color)
          .attr("stroke-width", d => 1 + d.energy * 3)
          .attr("opacity", d => 0.5 + d.energy * 0.4);
        connectors.exit().remove();
      }

      animationRef.current = requestAnimationFrame(renderFrame);
    };

    renderFrame();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyser, isPlaying, mode]);

  return (
    <div className="w-full h-full flex items-center justify-center p-0 md:p-8 rounded-xl overflow-hidden relative">
      <svg ref={svgRef} width="100%" height="100%" preserveAspectRatio="none" style={{ overflow: 'visible' }}></svg>
    </div>
  );
};

export default Visualizer;