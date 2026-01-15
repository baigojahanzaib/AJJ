import { useState, useCallback, ReactNode } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import Toast, { ToastType } from '@/components/Toast';

const [NotificationProviderInternal, useNotificationInternal] = createContextHook(() => {
    const [visible, setVisible] = useState(false);
    const [message, setMessage] = useState('');
    const [type, setType] = useState<ToastType>('info');

    const showToast = useCallback((msg: string, toastType: ToastType = 'info') => {
        setMessage(msg);
        setType(toastType);
        setVisible(true);
    }, []);

    const hideToast = useCallback(() => {
        setVisible(false);
    }, []);

    return {
        showToast,
        hideToast,
        visible,
        message,
        type,
    };
});

// Wrapper component to render the Toast UI
export const NotificationProvider = ({ children }: { children: ReactNode }) => {
    return (
        <NotificationProviderInternal>
            <NotificationUI>{children}</NotificationUI>
        </NotificationProviderInternal>
    );
};

const NotificationUI = ({ children }: { children: ReactNode }) => {
    const { visible, message, type, hideToast } = useNotificationInternal();
    return (
        <>
            {children}
            <Toast
                visible={visible}
                message={message}
                type={type}
                onHide={hideToast}
            />
        </>
    );
};

export const useNotification = useNotificationInternal;
