/**
 * LoginPage Component
 * User authentication and registration page
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, Mail, UserPlus, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../api/api';
import type { LoginRequest } from '../../types';
import jadeLogo from '../../assets/project_logo.png';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, isLoading, error, clearError } = useAuthStore();
  
  console.log('[LoginPage] Component render - isAuthenticated:', isAuthenticated, 'isLoading:', isLoading);

  const [isSignupMode, setIsSignupMode] = useState(false);
  const [credentials, setCredentials] = useState<LoginRequest>({
    username: '',
    password: '',
  });
  const [signupData, setSignupData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [signupError, setSignupError] = useState<string>('');
  const [signupSuccess, setSignupSuccess] = useState<string>('');
  const [signupLoading, setSignupLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    // Redirect to dashboard if already authenticated
    console.log('[LoginPage useEffect] isAuthenticated changed to:', isAuthenticated);
    if (isAuthenticated) {
      console.log('[LoginPage useEffect] Navigating to dashboard...');
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    // Clear error when component unmounts or mode changes
    return () => {
      clearError();
      setSignupError('');
      setSignupSuccess('');
    };
  }, [clearError, isSignupMode]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Login form submitted with credentials:', credentials);
    try {
      console.log('Calling login function...');
      await login(credentials);
      console.log('Login successful, isAuthenticated should be true now');
      // Navigation is handled by useEffect watching isAuthenticated
    } catch (error: any) {
      console.error('Login failed with error:', error);
      console.error('Error stack:', error.stack);
      // Error is handled by the store, prevent page reload
      return false;
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError('');
    setSignupSuccess('');

    // Validate passwords match
    if (signupData.password !== signupData.confirmPassword) {
      setSignupError('Passwords do not match');
      return;
    }

    // Validate password length
    if (signupData.password.length < 8) {
      setSignupError('Password must be at least 8 characters');
      return;
    }

    setSignupLoading(true);
    try {
      const response = await authApi.signup({
        username: signupData.username,
        email: signupData.email,
        password: signupData.password,
      });
      
      setSignupSuccess('Account created successfully! You can now sign in.');
      // Clear form
      setSignupData({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
      });
      
      // Switch to login mode after 2 seconds
      setTimeout(() => {
        setIsSignupMode(false);
        setSignupSuccess('');
      }, 2000);
    } catch (error: any) {
      console.error('Signup error:', error);
      
      // Network error
      if (error.code === 'ERR_NETWORK' || !error.response) {
        setSignupError('Cannot connect to server. Please check if the backend is running.');
      } 
      // Server responded with error
      else if (error.response?.data?.message) {
        setSignupError(error.response.data.message);
      }
      // Generic error
      else {
        setSignupError('Failed to create account. Please try again.');
      }
    } finally {
      setSignupLoading(false);
    }
  };

  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials((prev) => ({ ...prev, [name]: value }));
  };

  const handleSignupChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSignupData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleMode = () => {
    setIsSignupMode(!isSignupMode);
    clearError();
    setSignupError('');
    setSignupSuccess('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-gray-50 via-purple-50 to-gray-100">
      {/* Main content centered */}
      <div className="max-w-md w-full">
        {/* Jade Logo and title */}
        <div className="text-center mb-8">
          <img src={jadeLogo} alt="Jade Logo" className="w-full max-w-md h-auto mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Jade Global Automation Hub</h1>
          <p className="text-gray-600">Streamline your infrastructure management</p>
        </div>

        {/* Login/Signup form */}
        <div className="bg-white rounded-lg shadow-glow-lg p-8 border border-primary-200">
          {isSignupMode ? (
            // Signup Form
            <form onSubmit={handleSignupSubmit} className="space-y-6">
              {/* Error message */}
              {signupError && (
                <div className="bg-error-50 border border-error-300 text-error-800 px-4 py-3 rounded-md text-sm font-medium">
                  {signupError}
                </div>
              )}

              {/* Success message */}
              {signupSuccess && (
                <div className="bg-success-50 border border-success-300 text-success-800 px-4 py-3 rounded-md text-sm font-medium">
                  {signupSuccess}
                </div>
              )}

              {/* Username field */}
              <div>
                <label htmlFor="signup-username" className="block text-sm font-medium text-gray-700 mb-2">
                  Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="signup-username"
                    name="username"
                    type="text"
                    required
                    value={signupData.username}
                    onChange={handleSignupChange}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Choose a username"
                  />
                </div>
              </div>

              {/* Email field */}
              <div>
                <label htmlFor="signup-email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="signup-email"
                    name="email"
                    type="email"
                    required
                    value={signupData.email}
                    onChange={handleSignupChange}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="your@email.com"
                  />
                </div>
              </div>

              {/* Password field */}
              <div>
                <label htmlFor="signup-password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="signup-password"
                    name="password"
                    type={showSignupPassword ? "text" : "password"}
                    required
                    value={signupData.password}
                    onChange={handleSignupChange}
                    className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="At least 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupPassword(!showSignupPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-gray-400 hover:text-gray-600"
                  >
                    {showSignupPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password field */}
              <div>
                <label htmlFor="signup-confirm-password" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="signup-confirm-password"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={signupData.confirmPassword}
                    onChange={handleSignupChange}
                    className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Confirm your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={signupLoading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <UserPlus className="h-5 w-5" />
                {signupLoading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          ) : (
            // Login Form
            <form onSubmit={handleLoginSubmit} className="space-y-6">
              {/* Error message */}
              {error && (
                <div className="bg-error-50 border border-error-300 text-error-800 px-4 py-3 rounded-md text-sm font-medium">
                  {error}
                </div>
              )}

              {/* Username field */}
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                  Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    value={credentials.username}
                    onChange={handleLoginChange}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Enter your username"
                  />
                </div>
              </div>

              {/* Password field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={credentials.password}
                    onChange={handleLoginChange}
                    className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Submit button */}
              <button
                type="button"
                disabled={isLoading}
                onClick={(e) => {
                  e.preventDefault();
                  console.log('Button clicked!');
                  handleLoginSubmit(e as any);
                }}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          )}

          {/* Toggle between login and signup */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-600">
                  {isSignupMode ? 'Already have an account?' : "Don't have an account?"}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleMode}
              className="mt-4 w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
            >
              {isSignupMode ? 'Sign in instead' : 'Create new account'}
            </button>
          </div>

          
        </div>
      </div>
    </div>
  );
};
