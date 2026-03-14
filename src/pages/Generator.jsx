import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import VideoBackground from '../components/VideoBackground';
import PromptInterface from '../components/PromptInterface';
import { startGeneration } from '../services/api';
import './Generator.css';

function upsertPanel(panels, nextPanel) {
    const existingIndex = panels.findIndex((panel) => panel.orderIndex === nextPanel.orderIndex);

    if (existingIndex === -1) {
        return [...panels, nextPanel].sort((left, right) => left.orderIndex - right.orderIndex);
    }

    const updatedPanels = [...panels];
    updatedPanels[existingIndex] = {
        ...updatedPanels[existingIndex],
        ...nextPanel,
        metadata: {
            ...(updatedPanels[existingIndex].metadata || {}),
            ...(nextPanel.metadata || {}),
        },
    };

    return updatedPanels;
}

function mergeStreamEvent(panels, event) {
    if (event.type === 'done' || event.orderIndex < 0) {
        return panels;
    }

    const existingPanel = panels.find((panel) => panel.orderIndex === event.orderIndex);

    if (event.type === 'panel_prompt') {
        return upsertPanel(panels, {
            orderIndex: event.orderIndex,
            type: 'image',
            status: 'loading',
            content: '',
            prompt: event.content,
            metadata: event.metadata || {},
        });
    }

    if (event.type === 'image') {
        return upsertPanel(panels, {
            orderIndex: event.orderIndex,
            type: 'image',
            status: 'ready',
            content: event.content,
            prompt: existingPanel?.prompt || event.metadata?.imagePrompt || '',
            metadata: event.metadata || {},
        });
    }

    if (event.type === 'error') {
        if (event.orderIndex < 1) {
            return panels;
        }

        return upsertPanel(panels, {
            orderIndex: event.orderIndex,
            type: 'image',
            status: 'error',
            content: '',
            prompt: existingPanel?.prompt || event.metadata?.imagePrompt || '',
            error: event.metadata?.error || event.content,
            metadata: event.metadata || {},
        });
    }

    return upsertPanel(panels, {
        orderIndex: event.orderIndex,
        type: event.type,
        status: 'ready',
        content: event.content,
        metadata: event.metadata || {},
    });
}

function buildProgressMessage(event) {
    switch (event.type) {
        case 'panel_prompt':
            return `Director queued panel ${event.orderIndex}. Artist is rendering the shot...`;
        case 'image':
            return `Panel ${event.orderIndex} rendered and archived.`;
        case 'narration':
            return `Narration beat ${event.orderIndex} locked in.`;
        case 'dialogue':
            return `Dialogue beat ${event.orderIndex} locked in.`;
        case 'sfx':
            return `SFX beat ${event.orderIndex} dropped into the sequence.`;
        case 'done':
            return 'Finalizing archive...';
        case 'error':
            return event.orderIndex > 0
                ? `Panel ${event.orderIndex} failed to render.`
                : (event.content || 'Generation failed.');
        default:
            return 'Directing interleaved sequence...';
    }
}

function renderLivePanel(panel) {
    if (panel.type === 'image') {
        if (panel.status === 'loading') {
            return (
                <>
                    <div className="live-image-skeleton" />
                    <p className="text-mono live-prompt-label">PANEL_PROMPT</p>
                    <p className="text-mono live-prompt-copy">{panel.prompt}</p>
                </>
            );
        }

        if (panel.status === 'error') {
            return (
                <div className="live-image-error text-mono">
                    <span className="error-icon">!</span> {panel.error || 'Image generation failed'}
                </div>
            );
        }

        return <img src={panel.content} alt={`Panel ${panel.orderIndex}`} loading="lazy" />;
    }

    return (
        <p className={panel.type === 'sfx' ? 'text-display sfx-text' : 'text-mono'}>
            {panel.type === 'dialogue' && <span className="dialogue-mark">"</span>}
            {panel.content}
            {panel.type === 'dialogue' && <span className="dialogue-mark">"</span>}
        </p>
    );
}

function renderGalleryPanel(panel, index) {
    return (
        <div
            key={panel.orderIndex}
            className={`manga-panel-real panel-type-${panel.type} panel-status-${panel.status || 'ready'} fade-in-up`}
            style={{ animationDelay: `${index * 0.05}s` }}
        >
            {panel.type === 'image' ? (
                panel.status === 'loading' ? (
                    <div className="panel-image-loading">
                        <div className="panel-image-skeleton" />
                        <div className="panel-image-caption text-mono">PANEL_PROMPT</div>
                        <p className="panel-image-prompt text-mono">{panel.prompt}</p>
                    </div>
                ) : panel.status === 'error' ? (
                    <div className="panel-image-error text-mono">
                        <span className="panel-type-label text-mono">IMAGE</span>
                        <p>{panel.error || 'Image generation failed'}</p>
                        {panel.prompt && <p className="panel-image-prompt">{panel.prompt}</p>}
                    </div>
                ) : (
                    <img
                        src={panel.content}
                        alt={`Panel ${panel.orderIndex}`}
                        className="panel-image"
                        loading="lazy"
                    />
                )
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
    );
}

export default function Generator() {
    const navigate = useNavigate();
    const [appState, setAppState] = useState('idle');
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
        setProjectId(null);
        setProgress('Connecting to director...');
        panelCountRef.current = 0;

        try {
            const resultProjectId = await startGeneration(
                { prompt: promptText, genre: genre || 'SHONEN', panelCount: 12 },
                (event) => {
                    if (event.orderIndex > 0) {
                        panelCountRef.current = Math.max(panelCountRef.current, event.orderIndex);
                    }

                    setProgress(buildProgressMessage(event));
                    setPanels((prev) => mergeStreamEvent(prev, event));
                }
            );

            setProjectId(resultProjectId);
            setAppState('results');
        } catch (err) {
            console.error('[GENERATOR] Pipeline error:', err);
            const message = err instanceof Error ? err.message : 'Generation failed';
            setError(message);

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
        setProgress('');
    };

    const activeImageJobs = panels.filter((panel) => panel.type === 'image' && panel.status === 'loading').length;

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
                            <h2 className="text-display animate-glitch">DIRECTING SEQUENCE...</h2>
                            <p className="text-mono">{progress}</p>
                            <p className="text-mono prompt-echo">"{currentPrompt}"</p>

                            {panels.length > 0 && (
                                <div className="live-feed">
                                    <div className="live-feed-label text-mono">
                                        LIVE FEED — {panels.length} STORY BEATS / {activeImageJobs} PANELS RENDERING
                                    </div>
                                    <div className="live-panels">
                                        {panels.map((panel) => (
                                            <div key={panel.orderIndex} className={`live-panel live-panel-${panel.type} live-panel-${panel.status || 'ready'} fade-in-up`}>
                                                {renderLivePanel(panel)}
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
                                    panels.map((panel, index) => renderGalleryPanel(panel, index))
                                )}
                            </div>

                            <div className="results-meta text-mono">
                                <span>{panels.length} STORY BEATS</span>
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
