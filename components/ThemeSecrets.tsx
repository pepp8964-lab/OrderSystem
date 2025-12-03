
import React, { useEffect, useState, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ThemeContext';

const ThemeSecrets: React.FC = () => {
    const { theme } = useTheme();
    const { showToast } = useToast();
    const [clickCount, setClickCount] = useState(0);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // --- EFFECT: Matrix Rain ---
    useEffect(() => {
        if (theme !== 'matrix') return;
        
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const katakana = 'アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッン';
        const latin = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const nums = '0123456789';
        const alphabet = katakana + latin + nums;

        const fontSize = 16;
        const columns = canvas.width / fontSize;
        const rainDrops: number[] = [];

        for (let x = 0; x < columns; x++) {
            rainDrops[x] = 1;
        }

        const draw = () => {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = '#0F0';
            ctx.font = fontSize + 'px monospace';

            for (let i = 0; i < rainDrops.length; i++) {
                const text = alphabet.charAt(Math.floor(Math.random() * alphabet.length));
                ctx.fillText(text, i * fontSize, rainDrops[i] * fontSize);

                if (rainDrops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                    rainDrops[i] = 0;
                }
                rainDrops[i]++;
            }
        };

        const interval = setInterval(draw, 30);
        
        const handleResize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', handleResize);

        return () => {
            clearInterval(interval);
            window.removeEventListener('resize', handleResize);
        };
    }, [theme]);

    // --- EFFECT: Ocean Bubbles ---
    const renderBubbles = () => {
        if (theme !== 'ocean') return null;
        const bubbles = Array.from({ length: 15 }).map((_, i) => ({
            left: `${Math.random() * 100}%`,
            size: `${Math.random() * 20 + 10}px`,
            duration: `${Math.random() * 10 + 10}s`,
            delay: `${Math.random() * 5}s`
        }));

        return (
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
                {bubbles.map((b, i) => (
                    <div
                        key={i}
                        className="absolute bottom-[-50px] rounded-full border border-cyan-400/30 bg-cyan-400/10 shadow-[0_0_10px_rgba(0,255,255,0.2)]"
                        style={{
                            left: b.left,
                            width: b.size,
                            height: b.size,
                            animation: `float-up ${b.duration} linear infinite`,
                            animationDelay: b.delay
                        }}
                    />
                ))}
            </div>
        );
    };

    // --- EFFECT: Fireflies (Wood) ---
    const renderFireflies = () => {
        if (theme !== 'wood') return null;
        const fireflies = Array.from({ length: 20 }).map((_, i) => ({
            left: Math.random() * 100,
            top: Math.random() * 100,
            tx: (Math.random() - 0.5) * 200 + 'px',
            ty: (Math.random() - 0.5) * 200 + 'px',
            duration: Math.random() * 5 + 5 + 's',
            delay: Math.random() * 5 + 's'
        }));

        return (
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
                {fireflies.map((f, i) => (
                    <div
                        key={i}
                        className="absolute w-1 h-1 bg-yellow-400 rounded-full shadow-[0_0_5px_yellow]"
                        style={{
                            left: `${f.left}%`,
                            top: `${f.top}%`,
                            '--tx': f.tx,
                            '--ty': f.ty,
                            animation: `firefly-move ${f.duration} ease-in-out infinite alternate`,
                            animationDelay: f.delay
                        } as React.CSSProperties}
                    />
                ))}
            </div>
        );
    };

    // --- INTERACTIVE SECRETS ---

    const handleSecretClick = (secretName: string) => {
        setClickCount(prev => prev + 1);
        if (secretName === 'chest') {
            showToast("💰 Ви знайшли скарб піратів!");
        } else if (secretName === 'candy') {
            showToast("🍬 Цукровий передоз!");
        } else if (secretName === 'pill') {
            document.body.style.filter = 'invert(1)';
            setTimeout(() => document.body.style.filter = '', 200);
            showToast("🐰 Follow the white rabbit...");
        } else if (secretName === 'radar') {
            showToast("📡 Виявлено невідомий об'єкт!");
        } else if (secretName === 'owl') {
            showToast("🦉 Пугу-пугу!");
        } else if (secretName === 'glitch') {
            showToast("⚠️ SYSTEM ERROR ⚠️");
        }
    };

    return (
        <>
            {/* Background Effects */}
            {theme === 'matrix' && <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-[-1] opacity-30" />}
            {renderBubbles()}
            {renderFireflies()}
            
            {/* Fog for Halloween */}
            {theme === 'halloween' && (
                <div className="fixed inset-0 pointer-events-none z-0 bg-[url('https://raw.githubusercontent.com/danielstuart14/CSS_FOG_ANIMATION/master/fog1.png')] opacity-30 animate-[digital-rain_60s_linear_infinite]" style={{backgroundSize: 'cover', backgroundPosition: 'center'}}></div>
            )}

            {/* Interactive Elements (Secrets) */}
            <div className="fixed bottom-4 right-4 z-50">
                {theme === 'ocean' && (
                    <button 
                        onClick={() => handleSecretClick('chest')}
                        className="text-4xl hover:scale-125 transition-transform duration-300 opacity-50 hover:opacity-100"
                        title="Що тут?"
                    >
                        🏴‍☠️
                    </button>
                )}
                {theme === 'wood' && (
                    <button 
                        onClick={() => handleSecretClick('owl')}
                        className="text-4xl hover:scale-125 transition-transform duration-300 opacity-40 hover:opacity-100 grayscale hover:grayscale-0"
                        title="Хто там?"
                    >
                        🦉
                    </button>
                )}
                {theme === 'candy' && (
                    <button 
                        onClick={() => handleSecretClick('candy')}
                        className="text-4xl animate-bounce hover:scale-125 transition-transform duration-300"
                        title="З'їж мене"
                    >
                        🍭
                    </button>
                )}
                {theme === 'matrix' && (
                    <button 
                        onClick={() => handleSecretClick('pill')}
                        className="w-8 h-4 rounded-full bg-gradient-to-r from-red-600 to-blue-600 hover:shadow-[0_0_10px_white] transition-shadow"
                        title="Вибір за тобою"
                    />
                )}
                {theme === 'military' && (
                    <button 
                        onClick={() => handleSecretClick('radar')}
                        className="w-10 h-10 rounded-full border-2 border-green-500 bg-black/50 flex items-center justify-center relative overflow-hidden group"
                        title="Радар"
                    >
                        <div className="absolute w-full h-0.5 bg-green-500 top-1/2 animate-spin shadow-[0_0_5px_#0f0]"></div>
                        <span className="text-[8px] text-green-500 opacity-0 group-hover:opacity-100">TARGET</span>
                    </button>
                )}
                {theme === 'cyberpunk' && (
                    <button 
                        onClick={() => handleSecretClick('glitch')}
                        className="text-3xl font-mono text-cyan-400 hover:text-pink-500 hover:shadow-[2px_2px_0_#f0f] transition-all"
                        style={{textShadow: '2px 0 #f00, -2px 0 #00f'}}
                    >
                        &lt;/&gt;
                    </button>
                )}
            </div>
        </>
    );
};

export default ThemeSecrets;