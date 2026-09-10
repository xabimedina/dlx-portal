/**
 * Clave de localStorage donde el login guarda el email al que se envió el
 * enlace de acceso. La página /acceso la lee para completar el inicio de
 * sesión sin volver a pedir el email cuando el enlace se abre en el mismo
 * navegador que lo solicitó (si se abre en otro dispositivo, Firebase exige
 * teclearlo de nuevo: es la protección anti-intercepción del email link).
 */
export const EMAIL_FOR_SIGN_IN_KEY = "dlx-portal-email-for-sign-in";
