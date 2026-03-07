import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import VideoBackground from '../components/VideoBackground';
import PromptInterface from '../components/PromptInterface';
import { startGeneration } from '../services/api';
import './Generator.css';

export default function Generator() {
    const navigate = useNavigate();
    const [appState, setAppState] = useState('idle'); // idle, generating, results
    const [currentPrompt, setCurrentPrompt] = useState('');
    const [currentGenre, setCurrentGenre] = useState('SHONEN');
    const [panels, setPanels] = useState([]);
    const [progress, setProgress] = useState('');
    const [error, setError] = useState(null);
    const [projectId, setProjectId] = useState(null);
    const panelCountRef = useRef(0);

    const handleGenerate = async (promptText, genre) => {
        setCurrentPrompt(promptText);
        setCurrentGenre(genre || 'SHONEN');
        setAppState('generating');
        setPanels([]);
        setError(null);
        setProgress('Connecting to AI pipeline...');
        panelCountRef.current = 0;

        try {
            const resultProjectId = await startGeneration(
                { prompt: promptText, genre: genre || 'SHONEN', panelCount: 12 },
                (event) => {
                    // Handle each streaming panel event
                    panelCountRef.current += 1;
                    const count = panelCountRef.current;

                    if (event.type === 'error') {
                        setProgress(`Panel ${count} failed — retrying...`);
                        return;
                    }

                    setProgress(`Synthesizing panel ${count}...`);
                    setPanels(prev => [...prev, event]);
                }
            );

            setProjectId(resultProjectId);
            setAppState('results');
        } catch (err) {
            console.error('[GENERATOR] Pipeline error:', err);
            setError(err.message || 'Generation failed');
            // If we got some panels before the error, show results anyway
            if (panelCountRef.current > 0) {
                setAppState('results');
            } else {
                setAppState('idle');
            }
        }
    };

    const handleReset = () => {
        setAppState('idle');
        setCurrentPrompt('');
        setPanels([]);
        setError(null);
        setProjectId(null);
    };

    return (
        <>
            <div className="halftone-overlay" />
            <VideoBackground />

            <main className="generator-main fade-in-up">
                <header className="app-header">
                    <h1 className="logo text-display animate-glitch" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>RAGNA</h1>
                    <nav className="nav-links text-mono">
                        <a onClick={() => navigate('/')} style={{ color: 'inherit', textDecoration: 'none', cursor: 'pointer' }}>HOME</a>
                        <span className="separator">|</span>
                        <a onClick={() => navigate('/archives')} style={{ color: 'inherit', textDecoration: 'none', cursor: 'pointer' }}>ARCHIVES</a>
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
                            {error && (
                                <div className="error-banner text-mono fade-in-up">
                                    <span className="error-icon">!</span> {error}
                                </div>
                            )}
                        </div>
                    )}

                    {appState === 'generating' && (
                        <div className="loading-state fade-in-up">
                            <div className="loading-spinner"></div>
                            <h2 className="text-display animate-glitch">SYNTHESIZING PANELS...</h2>
                            <p className="text-mono">{progress}</p>
                            <p className="text-mono prompt-echo">"{currentPrompt}"</p>

                            {/* Live panel feed — panels appear as they stream in */}
                            {panels.length > 0 && (
                                <div className="live-feed">
                                    <div className="live-feed-label text-mono">LIVE FEED — {panels.length} PANELS RECEIVED</div>
                                    <div className="live-panels">
                                        {panels.map((panel, i) => (
                                            <div key={i} className={`live-panel live-panel-${panel.type} fade-in-up`}>
                                                {panel.type === 'image' ? (
                                                    <img src={panel.content} alt={`Panel ${panel.orderIndex}`} loading="lazy" />
                                                ) : (
                                                    <p className={panel.type === 'sfx' ? 'text-display sfx-text' : 'text-mono'}>
                                                        {panel.type === 'dialogue' && <span className="dialogue-mark">"</span>}
                                                        {panel.content}
                                                        {panel.type === 'dialogue' && <span className="dialogue-mark">"</span>}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {appState === 'results' && (
                        <div className="results-state fade-in-up">
                            <div className="results-header">
                                <h2 className="text-display">GENERATED SEQUENCE</h2>
                                <div className="results-actions">
                                    {projectId && (
                                        <button onClick={() => navigate('/archives')} className="archives-btn text-mono">
                                            [ VIEW_IN_ARCHIVES ]
                                        </button>
                                    )}
                                    <button onClick={handleReset} className="reset-btn text-mono">
                                        [ NEW_PROMPT ]
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div className="error-banner text-mono" style={{ marginBottom: '1rem' }}>
                                    <span className="error-icon">!</span> {error} — Showing partial results
                                </div>
                            )}

                            <div className="manga-gallery">
                                {panels.length === 0 ? (
                                    <div className="empty-results text-mono">
                                        No panels were generated. Try a different prompt.
                                    </div>
                                ) : (
                                    panels.map((panel, i) => (
                                        <div
                                            key={i}
                                            className={`manga-panel-real panel-type-${panel.type} fade-in-up`}
                                            style={{ animationDelay: `${i * 0.05}s` }}
                                        >
                                            {panel.type === 'image' ? (
                                                <img
                                                    src={panel.content}
                                                    alt={`Panel ${panel.orderIndex}`}
                                                    className="panel-image"
                                                    loading="lazy"
                                                />
                                            ) : panel.type === 'narration' ? (
                                                <div className="panel-narration">
                                                    <span className="panel-type-label text-mono">NARRATION</span>
                                                    <p className="text-mono">{panel.content}</p>
                                                </div>
                                            ) : panel.type === 'dialogue' ? (
                                                <div className="panel-dialogue">
                                                    <span className="panel-type-label text-mono">DIALOGUE</span>
                                                    <div className="dialogue-content">
                                                        <span className="dialogue-mark">"</span>
                                                        <p className="text-mono">{panel.content}</p>
                                                        <span className="dialogue-mark">"</span>
                                                    </div>
                                                </div>
                                            ) : panel.type === 'sfx' ? (
                                                <div className="panel-sfx">
                                                    <p className="text-display">{panel.content}</p>
                                                </div>
                                            ) : null}
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="results-meta text-mono">
                                <span>{panels.length} PANELS</span>
                                <span>GENRE: {currentGenre}</span>
                                {projectId && <span>PROJECT: {projectId.substring(0, 8)}...</span>}
                            </div>
                        </div>
                    )}
                </section>
            </main>
        </>
    );
}
