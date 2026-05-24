
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button.jsx';
import ProgressDots from '@/components/ProgressDots.jsx';
import DropZone from '@/components/DropZone.jsx';
import { Sparkles, Film, Share2, Heart, Briefcase } from 'lucide-react';
import { toast } from 'sonner';

const useCases = [
  { id: 'marketing', label: 'Marketing', icon: Briefcase },
  { id: 'social', label: 'Social Media', icon: Share2 },
  { id: 'film', label: 'Film', icon: Film },
  { id: 'personal', label: 'Personal', icon: Heart },
  { id: 'other', label: 'Other', icon: Sparkles }
];

const OnboardingPage = () => {
  const navigate = useNavigate();
  const { currentUser, updateProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [selectedUseCase, setSelectedUseCase] = useState('');
  const [uploadedImage, setUploadedImage] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleComplete = async () => {
    setLoading(true);
    
    try {
      await updateProfile({ onboarding_completed: true });
      toast('Welcome to your workspace');
      navigate('/app/dashboard');
    } catch (error) {
      toast('Failed to complete onboarding');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (step === 0 && !selectedUseCase) {
      toast('Please select a use case');
      return;
    }
    
    if (step < 2) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  return (
    <>
      <Helmet>
        <title>Welcome - Get started</title>
        <meta name="description" content="Complete your profile setup" />
      </Helmet>

      <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[hsl(var(--canvas))]">
        <div className="w-full max-w-2xl">
          <div className="mb-8">
            <ProgressDots total={3} current={step} />
          </div>

          <div className="glass-surface rounded-xl p-8 shadow-glass-lg">
            {step === 0 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h1 className="text-3xl font-bold mb-2">What will you create?</h1>
                  <p className="text-[hsl(var(--text-secondary))]">
                    Help us personalize your experience
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {useCases.map((useCase) => {
                    const Icon = useCase.icon;
                    return (
                      <button
                        key={useCase.id}
                        onClick={() => setSelectedUseCase(useCase.id)}
                        className={`p-6 rounded-xl border-2 transition-all ${
                          selectedUseCase === useCase.id
                            ? 'border-[hsl(var(--accent-primary))] bg-[hsl(var(--accent-primary))]/5'
                            : 'border-[hsl(var(--border))] hover:border-[hsl(var(--accent-primary))]/50'
                        }`}
                      >
                        <Icon className="w-8 h-8 mx-auto mb-3 text-[hsl(var(--accent-primary))]" />
                        <p className="font-medium">{useCase.label}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h1 className="text-3xl font-bold mb-2">Connect your first media</h1>
                  <p className="text-[hsl(var(--text-secondary))]">
                    Upload an image to get started (optional)
                  </p>
                </div>

                <DropZone onFileSelect={setUploadedImage} />

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setStep(2)}
                >
                  Skip for now
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6 text-center">
                <div className="w-20 h-20 rounded-full bg-[hsl(var(--accent-primary))]/10 flex items-center justify-center mx-auto">
                  <Sparkles className="w-10 h-10 text-[hsl(var(--accent-primary))]" />
                </div>

                <div>
                  <h1 className="text-3xl font-bold mb-2">You're ready to create</h1>
                  <p className="text-[hsl(var(--text-secondary))]">
                    Your workspace is set up and ready to go
                  </p>
                </div>

                <div className="glass-elevated rounded-xl p-6">
                  <p className="text-sm text-[hsl(var(--text-secondary))] mb-2">
                    Starting credit balance
                  </p>
                  <p className="text-4xl font-bold text-[hsl(var(--accent-primary))]">
                    {currentUser?.credits_balance || 100} credits
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mt-8 pt-6 border-t border-[hsl(var(--border))]">
              {step > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setStep(step - 1)}
                >
                  Back
                </Button>
              )}
              
              <Button
                onClick={handleNext}
                disabled={loading}
                className={step === 0 ? 'ml-auto' : ''}
              >
                {loading ? 'Setting up...' : step === 2 ? 'Go to Dashboard' : 'Continue'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default OnboardingPage;
