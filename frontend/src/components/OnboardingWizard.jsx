import React, { useState } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function OnboardingWizard() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    business_name: "",
    business_type: "retail",
    start_time: "09:00",
    end_time: "17:00",
  });

  const businessTypes = [
    { value: "retail", label: "Retail / E-commerce" },
    { value: "restaurant", label: "Restaurant / Cafe" },
    { value: "services", label: "Professional Services" },
    { value: "healthcare", label: "Healthcare / Clinic" },
  ];

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const nextStep = () => setStep((s) => s + 1);
  const prevStep = () => setStep((s) => s - 1);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Update user profile (business name and type)
      const { data: updatedUser } = await api.put("/auth/me", {
        business_name: formData.business_name,
        business_type: formData.business_type,
      });

      // 2. Add default time slots for business hours (Monday-Friday for simplicity)
      const days = ["monday", "tuesday", "wednesday", "thursday", "friday"];
      for (const day of days) {
        await api.post("/bookings/timeslots", {
          day_of_week: day,
          start_time: formData.start_time,
          end_time: formData.end_time,
          is_active: true,
        });
      }

      setUser(updatedUser);
      navigate("/");
    } catch (err) {
      console.error("Failed to complete onboarding:", err);
      alert("Failed to save settings. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-lg w-full">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome to AI Assistant! 👋
          </h2>
          <p className="text-gray-600">
            Let's set up your business profile in just a few steps.
          </p>
        </div>

        {/* Progress Bar */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-2 flex-1 rounded-full ${
                step >= i ? "bg-indigo-600" : "bg-gray-200"
              }`}
            />
          ))}
        </div>

        <form onSubmit={step === 3 ? handleSubmit : (e) => { e.preventDefault(); nextStep(); }}>
          {step === 1 && (
            <div className="space-y-4 animate-fadeIn">
              <h3 className="text-xl font-semibold">What's your business name?</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Business Name
                </label>
                <input
                  type="text"
                  name="business_name"
                  required
                  value={formData.business_name}
                  onChange={handleChange}
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-3 border"
                  placeholder="e.g. Acme Corp"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-fadeIn">
              <h3 className="text-xl font-semibold">Choose your business type</h3>
              <p className="text-sm text-gray-500 mb-4">
                This helps us configure the perfect AI template for you.
              </p>
              <div className="grid grid-cols-1 gap-3">
                {businessTypes.map((type) => (
                  <label
                    key={type.value}
                    className={`border p-4 rounded-lg cursor-pointer transition-colors ${
                      formData.business_type === type.value
                        ? "border-indigo-600 bg-indigo-50"
                        : "border-gray-200 hover:border-indigo-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="business_type"
                        value={type.value}
                        checked={formData.business_type === type.value}
                        onChange={handleChange}
                        className="text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      />
                      <span className="font-medium text-gray-900">
                        {type.label}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-fadeIn">
              <h3 className="text-xl font-semibold">Set your business hours</h3>
              <p className="text-sm text-gray-500 mb-4">
                When are you typically open for business? (Monday-Friday)
              </p>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Opening Time
                  </label>
                  <input
                    type="time"
                    name="start_time"
                    required
                    value={formData.start_time}
                    onChange={handleChange}
                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-3 border"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Closing Time
                  </label>
                  <input
                    type="time"
                    name="end_time"
                    required
                    value={formData.end_time}
                    onChange={handleChange}
                    className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-3 border"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 flex justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={prevStep}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
            ) : (
              <div /> // Spacer
            )}
            
            <button
              type="submit"
              disabled={loading || (step === 1 && !formData.business_name.trim())}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>Saving...</>
              ) : step === 3 ? (
                "Finish Setup"
              ) : (
                "Next Step"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
