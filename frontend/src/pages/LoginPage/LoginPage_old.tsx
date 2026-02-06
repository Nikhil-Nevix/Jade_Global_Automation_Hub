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
import projectLogo from '../../assets/Infra_Automation_Hub.jpg';
import jadeLogo from '../../assets/JadeLogo-bg.png';

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-purple-50/30 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-primary-200/40 to-purple-300/40 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-blue-200/40 to-primary-200/40 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-purple-100/20 to-primary-100/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 py-12">
        {/* Logos Header */}
        <div className="flex items-center justify-center gap-16 mb-12">
          {/* Jade Global Logo */}
          <div className="relative group">
            <div className="absolute -inset-2 bg-gradient-to-r from-primary-400/30 to-purple-400/30 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
            <div className="relative bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl p-8 border border-gray-200/50 transform transition-all duration-500 hover:scale-105 hover:shadow-2xl">
              <img 
                src={jadeLogo} 
                alt="Jade Global" 
                className="h-16 w-auto filter drop-shadow-lg"
              />
            </div>
          </div>

          {/* Divider */}
          <div className="hidden md:flex items-center gap-3">
            <div className="w-20 h-px bg-gradient-to-r from-transparent via-primary-300 to-transparent"></div>
            <div className="w-2 h-2 rounded-full bg-primary-400 animate-pulse"></div>
            <div className="w-20 h-px bg-gradient-to-r from-transparent via-primary-300 to-transparent"></div>
          </div>

          {/* Project Logo */}
          <div className="relative group">
            <div className="absolute -inset-2 bg-gradient-to-r from-purple-400/30 to-primary-400/30 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
            <div className="relative bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl p-8 border border-gray-200/50 transform transition-all duration-500 hover:scale-105 hover:shadow-2xl">
              <img 
                src={projectLogo} 
                alt="Infra Automation Hub" 
                className="h-16 w-auto filter drop-shadow-lg rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Title Section */}
        <div className="text-center mb-10">
          <h1 className="text-5xl md:text-6xl font-black mb-4 bg-gradient-to-r from-gray-900 via-primary-700 to-purple-800 bg-clip-text text-transparent tracking-tight leading-tight">
            Infra Automation Hub
          </h1>
          <p className="text-gray-600 text-lg font-medium">
            Streamline your infra management with intelligent automation
          </p>
        </div>

        {/* Login/Signup Card */}
        <div className="max-w-md mx-auto relative">
          {/* Animated border glow */}
          <div className="absolute -inset-1 bg-gradient-to-r from-primary-600 via-purple-600 to-primary-600 rounded-3xl blur-xl opacity-20 group-hover:opacity-30 transition-all duration-700 animate-gradient bg-[length:200%_auto]"></div>
          
          {/* Main Card */}
          <div className="relative bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-gray-200/50 overflow-hidden">
            {/* Card Header */}
            <div className="bg-gradient-to-r from-primary-600 via-purple-600 to-primary-700 px-10 py-8 text-white">
              <h2 className="text-3xl font-bold mb-2">
                {isSignupMode ? 'Create Account' : 'Welcome Back'}
              </h2>
              <p className="text-primary-100 text-sm">
                {isSignupMode ? 'Join us to streamline your infrastructure' : 'Sign in to access your automation hub'}
              </p>
            </div>

            {/* Card Body */}
            <div className="px-10 py-8">{isSignupMode ? (
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
                <label htmlFor="signup-username" className="block text-sm font-semibold text-gray-800 mb-2.5">
                  Username
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors">
                    <User className="h-5 w-5 text-gray-400 group-focus-within:text-primary-600" />
                  </div>
                  <input
                    id="signup-username"
                    name="username"
                    type="text"
                    required
                    value={signupData.username}
                    onChange={handleSignupChange}
                    className="block w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl leading-5 bg-gray-50/50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all shadow-sm hover:border-gray-300"
                    placeholder="Choose a username"
                  />
                </div>
              </div>

              {/* Email field */}
              <div>
                <label htmlFor="signup-email" className="block text-sm font-semibold text-gray-800 mb-2.5">
                  Email Address
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors">
                    <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-primary-600" />
                  </div>
                  <input
                    id="signup-email"
                    name="email"
                    type="email"
                    required
                    value={signupData.email}
                    onChange={handleSignupChange}
                    className="block w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl leading-5 bg-gray-50/50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all shadow-sm hover:border-gray-300"
                    placeholder="your@email.com"
                  />
                </div>
              </div>

              {/* Password field */}
              <div>
                <label htmlFor="signup-password" className="block text-sm font-semibold text-gray-800 mb-2.5">
                  Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors">
                    <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-primary-600" />
                  </div>
                  <input
                    id="signup-password"
                    name="password"
                    type={showSignupPassword ? "text" : "password"}
                    required
                    value={signupData.password}
                    onChange={handleSignupChange}
                    className="block w-full pl-12 pr-12 py-3.5 border-2 border-gray-200 rounded-xl leading-5 bg-gray-50/50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all shadow-sm hover:border-gray-300"
                    placeholder="At least 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupPassword(!showSignupPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center cursor-pointer text-gray-400 hover:text-primary-600 transition-colors z-10"
                  >
                    {showSignupPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password field */}
              <div>
                <label htmlFor="signup-confirm-password" className="block text-sm font-semibold text-gray-800 mb-2.5">
                  Confirm Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors">
                    <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-primary-600" />
                  </div>
                  <input
                    id="signup-confirm-password"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={signupData.confirmPassword}
                    onChange={handleSignupChange}
                    className="block w-full pl-12 pr-12 py-3.5 border-2 border-gray-200 rounded-xl leading-5 bg-gray-50/50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all shadow-sm hover:border-gray-300"
                    placeholder="Confirm your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center cursor-pointer text-gray-400 hover:text-primary-600 transition-colors z-10"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={signupLoading}
                className="w-full flex justify-center items-center space-x-2 py-4 px-6 border border-transparent rounded-xl shadow-lg text-base font-bold text-white bg-gradient-to-r from-primary-600 via-primary-700 to-primary-600 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] bg-[length:200%_auto] hover:bg-right-bottom"
              >
                <UserPlus className="h-5 w-5" />
                <span>{signupLoading ? 'Creating account...' : 'Create Account'}</span>
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
                <label htmlFor="username" className="block text-sm font-semibold text-gray-800 mb-2.5">
                  Username
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors">
                    <User className="h-5 w-5 text-gray-400 group-focus-within:text-primary-600" />
                  </div>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    value={credentials.username}
                    onChange={handleLoginChange}
                    className="block w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl leading-5 bg-gray-50/50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all shadow-sm hover:border-gray-300"
                    placeholder="Enter your username"
                  />
                </div>
              </div>

              {/* Password field */}
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-800 mb-2.5">
                  Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors">
                    <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-primary-600" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={credentials.password}
                    onChange={handleLoginChange}
                    className="block w-full pl-12 pr-12 py-3.5 border-2 border-gray-200 rounded-xl leading-5 bg-gray-50/50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all shadow-sm hover:border-gray-300"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center cursor-pointer text-gray-400 hover:text-primary-600 transition-colors z-10"
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
                className="w-full flex justify-center items-center space-x-2 py-4 px-6 border border-transparent rounded-xl shadow-lg text-base font-bold text-white bg-gradient-to-r from-primary-600 via-primary-700 to-primary-600 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] bg-[length:200%_auto] hover:bg-right-bottom"
              >
                <span>{isLoading ? 'Signing in...' : 'Sign In'}</span>
              </button>
            </form>
          )}

          {/* Toggle between login and signup */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-center text-sm text-gray-600 mb-4">
              {isSignupMode ? 'Already have an account?' : "Don't have an account?"}
            </p>
            <button
              type="button"
              onClick={toggleMode}
              className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 hover:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all duration-200"
            >
              {isSignupMode ? 'Sign in to your account' : 'Create a new account'}
            </button>
          </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500">
            © 2026 Jade Global. All rights reserved.
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Powered by Infra Automation Hub
          </p>
        </div>
      </div>
    </div>
  );
};
