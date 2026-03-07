import React, { useState } from 'react';
import VideoBackground from '../components/VideoBackground';
import PromptInterface from '../components/PromptInterface';
import './Generator.css';

export default function Generator() {
    const [appState, setAppState] = useState('idle'); // idle, generating, results
    const [currentPrompt, setCurrentPrompt] = useState('');

    const handleGenerate = (promptText) => {
        setCurrentPrompt(promptText);
        setAppState('generating');

        // Simulate generation time
        setTimeout(() => {
            setAppState('results');
        }, 4000);
    };

    const handleReset = () => {
        setAppState('idle');
        setCurrentPrompt('');
    };

    return (
        <>
            <div className="halftone-overlay" />
            <VideoBackground />

            <main className="generator-main fade-in-up">
                <header className="app-header">
                    <h1 className="logo text-display animate-glitch">RAGNA</h1>
                    <nav className="nav-links text-mono">
                        <a href="/" style={{ color: 'inherit', textDecoration: 'none' }}>HOME</a>
                        <span className="separator">|</span>
                        <span>v2.0.4</span>
                        <span className="separator">|</span>
                        <span style={{ color: 'var(--color-accent-red)' }}>SYSTEM_ONLINE</span>
                    </nav>
                </header>

                <section className="app-content">
                    {appState === 'idle' && (
                        <div className="hero-section">
                            <h1 className="hero-title text-display fade-in-up">
                                MANIFEST THE <br /> <span className="text-accent">UNSEEN</span>
                            </h1>
                            <PromptInterface onGenerate={handleGenerate} />
                        </div>
                    )}

                    {appState === 'generating' && (
                        <div className="loading-state fade-in-up">
                            <div className="loading-spinner"></div>
                            <h2 className="text-display animate-glitch">SYNTHESIZING PANELS...</h2>
                            <p className="text-mono">Executing prompt: "{currentPrompt}"</p>
                        </div>
                    )}

                    {appState === 'results' && (
                        <div className="results-state fade-in-up">
                            <div className="results-header">
                                <h2 className="text-display">GENERATED SEQUENCE</h2>
                                <button onClick={handleReset} className="reset-btn text-mono">
                                    [ NEW_PROMPT ]
                                </button>
                            </div>

                            <div className="manga-gallery">
                                <div className="manga-panel aspect-w aspect-wide">
                                    <div className="panel-placeholder">PANEL_01</div>
                                </div>
                                <div className="gallery-row">
                                    <div className="manga-panel aspect-tall">
                                        <div className="panel-placeholder">PANEL_02</div>
                                    </div>
                                    <div className="manga-panel aspect-square">
                                        <div className="panel-placeholder">PANEL_03</div>
                                    </div>
                                </div>
                                <div className="manga-panel aspect-w aspect-wide">
                                    <div className="panel-placeholder">PANEL_04</div>
                                </div>
                            </div>
                        </div>
                    )}
                </section>
            </main>
        </>
    );
}
