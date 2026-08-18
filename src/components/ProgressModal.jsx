import React from 'react';

const ProgressModal = ({
  isOpen,
  title = 'Processando Dados',
  current = 0,
  total = 0,
  message = 'Aguarde um momento...',
  subMessage = 'Por favor, aguarde a conclusão da gravação para evitar duplicidades.'
}) => {
  if (!isOpen) return null;

  const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  const isIndeterminate = total <= 0;

  return (
    <div className="process-modal-backdrop">
      <div className="process-modal-card glass">
        <div className="process-modal-header">
          <div className="process-spinner-ring"></div>
          <div className="process-modal-titles">
            <h3 className="process-title">{title}</h3>
            <span className="process-subtitle">{message}</span>
          </div>
        </div>

        <div className="process-body">
          <div className="process-progress-track">
            <div
              className={`process-progress-bar ${isIndeterminate ? 'indeterminate' : ''}`}
              style={{ width: isIndeterminate ? '100%' : `${percent}%` }}
            ></div>
          </div>

          <div className="process-stats-row">
            {!isIndeterminate ? (
              <>
                <span className="process-stats-count">
                  {current} de {total} itens processados
                </span>
                <span className="process-stats-percent">{percent}%</span>
              </>
            ) : (
              <span className="process-stats-count">Processando gravação no banco...</span>
            )}
          </div>

          <div className="process-alert-box">
            <span className="process-alert-icon">⚠️</span>
            <span className="process-alert-text">{subMessage}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressModal;
