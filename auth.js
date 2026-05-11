// SISTEMA DE TABS
function showTab(tabName) {
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  
  document.querySelectorAll('.auth-form').forEach(form => {
    form.classList.remove('active');
  });
  
  document.getElementById('tab-' + tabName).classList.add('active');
  document.getElementById('form-' + tabName).classList.add('active');
  
  clearAlerts();
}

// SISTEMA DE ALERTAS
function showAlert(formId, type, message) {
  clearAlerts();
  const alert = document.getElementById('alert-' + formId + '-' + type);
  if (alert) {
    alert.querySelector('.alert-msg').textContent = message;
    alert.classList.add('show');
  }
}

function clearAlerts() {
  document.querySelectorAll('.sys-alert').forEach(alert => {
    alert.classList.remove('show');
  });
}

// MOSTRAR/OCULTAR CONTRASEÑA
function togglePass(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
  } else {
    input.type = 'password';
  }
}

// MEDIDOR DE FUERZA DE CONTRASEÑA
function updatePasswordStrength(password, fillId, labelId) {
  const fill = document.getElementById(fillId);
  const label = document.getElementById(labelId);
  
  if (!fill || !label) return;
  
  let strength = 0;
  if (password.length >= 8) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  
  const colors = ['#EF4444', '#F59E0B', '#3DBE8A'];
  const labels = ['Débil', 'Aceptable', 'Fuerte'];
  const widths = ['33%', '66%', '100%'];
  
  if (strength > 0) {
    fill.style.width = widths[strength - 1];
    fill.style.background = colors[strength - 1];
    label.textContent = labels[strength - 1];
  } else {
    fill.style.width = '0%';
    label.textContent = '';
  }
}

// LISTENER PARA FUERZA DE CONTRASEÑA
const regPassword = document.getElementById('reg-password');
if (regPassword) {
  regPassword.addEventListener('input', function() {
    updatePasswordStrength(this.value, 'strength-fill', 'strength-label');
  });
}

// ═══════════════════════════════════════════════════════════
// REGISTRO DE USUARIO
// ═══════════════════════════════════════════════════════════
const formRegister = document.getElementById('form-register');
if (formRegister) {
  formRegister.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const nombre = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;
    
    // Validar
    if (!nombre || nombre.length < 2) {
      showAlert('register', 'error', 'El nombre debe tener al menos 2 caracteres');
      return;
    }
    
    if (!email) {
      showAlert('register', 'error', 'Ingresa tu correo');
      return;
    }
    
    if (password.length < 8) {
      showAlert('register', 'error', 'La contraseña debe tener mínimo 8 caracteres');
      return;
    }
    
    if (!/[A-Z]/.test(password)) {
      showAlert('register', 'error', 'La contraseña debe tener una mayúscula');
      return;
    }
    
    if (!/[0-9]/.test(password)) {
      showAlert('register', 'error', 'La contraseña debe tener un número');
      return;
    }
    
    if (password !== confirm) {
      showAlert('register', 'error', 'Las contraseñas no coinciden');
      return;
    }
    
    // Mostrar loading
    const btn = document.getElementById('btn-register');
    const spinner = btn.querySelector('.spinner');
    const btnText = btn.querySelector('.btn-text');
    
    spinner.style.display = 'block';
    btnText.textContent = 'Creando cuenta...';
    btn.disabled = true;
    
    try {
      // REGISTRAR EN SUPABASE
      const result = await window.supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            nombre_completo: nombre
          }
        }
      });
      
      if (result.error) {
        throw result.error;
      }
      
      showAlert('register', 'success', '¡Cuenta creada! Puedes iniciar sesión ahora.');
      formRegister.reset();
      
      setTimeout(function() {
        showTab('login');
      }, 2000);
      
    } catch (error) {
      console.error('Error:', error);
      showAlert('register', 'error', 'Error al crear cuenta: ' + error.message);
    } finally {
      spinner.style.display = 'none';
      btnText.textContent = 'Crear cuenta';
      btn.disabled = false;
    }
  });
}

// ═══════════════════════════════════════════════════════════
// INICIO DE SESIÓN
// ═══════════════════════════════════════════════════════════
const formLogin = document.getElementById('form-login');
if (formLogin) {
  formLogin.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('log-email').value.trim();
    const password = document.getElementById('log-password').value;
    
    if (!email || !password) {
      showAlert('login', 'error', 'Ingresa tu correo y contraseña');
      return;
    }
    
    const btn = document.getElementById('btn-login');
    const spinner = btn.querySelector('.spinner');
    const btnText = btn.querySelector('.btn-text');
    
    spinner.style.display = 'block';
    btnText.textContent = 'Verificando...';
    btn.disabled = true;
    
    try {
      // INICIAR SESIÓN EN SUPABASE
      const result = await window.supabase.auth.signInWithPassword({
        email: email,
        password: password
      });
      
      if (result.error) {
        throw result.error;
      }

      // Consultar rol para redirigir al panel correcto
      let destino = 'app.html';
      try {
        const userId = result.data.user.id;
        const { data: perfil } = await window.supabase
          .from('perfiles')
          .select('rol')
          .eq('id', userId)
          .single();
        if (perfil?.rol === 'administrador' || perfil?.rol === 'gestor') {
          destino = 'admin.html';
        }
      } catch (_) { /* perfil no encontrado, usar app.html */ }

      showAlert('login', 'success', 'Ingreso exitoso. Redirigiendo...');

      setTimeout(function() {
        window.location.href = destino;
      }, 1000);
      
    } catch (error) {
      console.error('Error:', error);
      
      if (error.message.includes('Invalid login')) {
        showAlert('login', 'error', 'Correo o contraseña incorrectos');
      } else {
        showAlert('login', 'error', 'Error al iniciar sesión: ' + error.message);
      }
    } finally {
      spinner.style.display = 'none';
      btnText.textContent = 'Iniciar sesión';
      btn.disabled = false;
    }
  });
}

// ═══════════════════════════════════════════════════════════
// INICIO DE SESIÓN CON GOOGLE
// ═══════════════════════════════════════════════════════════
async function signInWithGoogle() {
  const btn = document.getElementById('btn-google-login');
  if (btn) {
    btn.disabled = true;
    btn.querySelector('span').textContent = 'Redirigiendo...';
  }
  try {
    const { error } = await window.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'https://visionbarrial.netlify.app/app.html' }
    });
    if (error) throw error;
  } catch (error) {
    console.error('Error con Google:', error);
    if (btn) {
      btn.disabled = false;
      btn.querySelector('span').textContent = 'Continuar con Google';
    }
    showAlert('login', 'error', 'Error al iniciar sesión con Google: ' + error.message);
  }
}

const btnGoogle = document.getElementById('btn-google-login');
if (btnGoogle) btnGoogle.addEventListener('click', signInWithGoogle);

// ═══════════════════════════════════════════════════════════
// RECUPERAR CONTRASEÑA
// ═══════════════════════════════════════════════════════════
const formRecover = document.getElementById('form-recover');
if (formRecover) {
  formRecover.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('rec-email').value.trim();
    
    if (!email) {
      showAlert('recover', 'error', 'Ingresa tu correo');
      return;
    }
    
    try {
      const result = await window.supabase.auth.resetPasswordForEmail(email);
      
      if (result.error) {
        throw result.error;
      }
      
      showAlert('recover', 'info', 'Enlace enviado a ' + email);
      
    } catch (error) {
      console.error('Error:', error);
      showAlert('recover', 'error', 'Error al enviar enlace');
    }
  });
}