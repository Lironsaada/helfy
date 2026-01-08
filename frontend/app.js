// API URL will be proxied through nginx in Docker, or direct to backend locally
const API_URL = '/api';

// Get DOM elements
const loginSection = document.getElementById('login-section');
const registerSection = document.getElementById('register-section');
const dashboardSection = document.getElementById('dashboard-section');

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const logoutBtn = document.getElementById('logout-btn');

const showRegisterLink = document.getElementById('show-register');
const showLoginLink = document.getElementById('show-login');

const loginError = document.getElementById('login-error');
const registerError = document.getElementById('register-error');

// Check if user is already logged in
function checkAuth() {
    const token = localStorage.getItem('authToken');
    if (token) {
        // Verify token by fetching user data
        fetch(`${API_URL}/me`, {
            headers: {
                'Authorization': token
            }
        })
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                // Token invalid, clear it
                localStorage.removeItem('authToken');
                throw new Error('Invalid token');
            }
        })
        .then(data => {
            showDashboard(data.user);
        })
        .catch(error => {
            console.error('Auth check failed:', error);
            showLogin();
        });
    } else {
        showLogin();
    }
}

// Show/hide sections
function showLogin() {
    loginSection.style.display = 'block';
    registerSection.style.display = 'none';
    dashboardSection.style.display = 'none';
    loginError.textContent = '';
}

function showRegister() {
    loginSection.style.display = 'none';
    registerSection.style.display = 'block';
    dashboardSection.style.display = 'none';
    registerError.textContent = '';
}

function showDashboard(user) {
    loginSection.style.display = 'none';
    registerSection.style.display = 'none';
    dashboardSection.style.display = 'block';

    // Populate user info
    document.getElementById('user-name').textContent = user.username;
    document.getElementById('user-id').textContent = user.id;
    document.getElementById('user-email').textContent = user.email;
    document.getElementById('user-username').textContent = user.username;
}

// Event listeners
showRegisterLink.addEventListener('click', (e) => {
    e.preventDefault();
    showRegister();
});

showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    showLogin();
});

// Login form submission
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';

    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    // Client-side validation
    if (!username || !password) {
        loginError.textContent = 'Please fill in all fields';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            // Store token
            localStorage.setItem('authToken', data.token);

            // Show dashboard
            showDashboard(data.user);

            // Clear form
            loginForm.reset();
        } else {
            loginError.textContent = data.error || 'Login failed';
        }
    } catch (error) {
        console.error('Login error:', error);
        loginError.textContent = 'Network error. Please try again.';
    }
});

// Register form submission
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    registerError.textContent = '';

    const email = document.getElementById('register-email').value.trim();
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value;

    // Client-side validation
    if (!email || !username || !password) {
        registerError.textContent = 'Please fill in all fields';
        return;
    }

    if (password.length < 6) {
        registerError.textContent = 'Password must be at least 6 characters';
        return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        registerError.textContent = 'Please enter a valid email';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, username, password })
        });

        const data = await response.json();

        if (response.ok) {
            // Registration successful, show login
            alert('Registration successful! Please log in.');
            registerForm.reset();
            showLogin();
        } else {
            registerError.textContent = data.error || 'Registration failed';
        }
    } catch (error) {
        console.error('Registration error:', error);
        registerError.textContent = 'Network error. Please try again.';
    }
});

// Logout
logoutBtn.addEventListener('click', async () => {
    const token = localStorage.getItem('authToken');

    try {
        await fetch(`${API_URL}/logout`, {
            method: 'POST',
            headers: {
                'Authorization': token
            }
        });
    } catch (error) {
        console.error('Logout error:', error);
    }

    // Clear token and show login
    localStorage.removeItem('authToken');
    showLogin();
});

// Initialize
checkAuth();
