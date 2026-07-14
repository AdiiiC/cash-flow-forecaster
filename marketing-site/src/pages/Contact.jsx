import React, { useState } from 'react';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Calendar, Mail, MapPin, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Reveal } from '../components/Motion';

const schema = z.object({
  name: z.string().min(2, 'Please enter your name.').max(120),
  email: z.string().email('Please enter a valid work email.'),
  company: z.string().min(2, 'Please enter your company.').max(160),
  team_size: z.string().min(1, 'Pick a team size.'),
  message: z.string().min(10, 'A one-line note helps — at least 10 characters.').max(4000),
});

const teamSizes = ['1 (solo)', '2–10', '11–50', '51–200', '201+'];

export default function Contact() {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', company: '', team_size: '', message: '' },
  });

  const onSubmit = async (values) => {
    setSubmitting(true);
    try {
      const base = process.env.REACT_APP_BACKEND_URL;
      await axios.post(`${base}/api/contact`, values);
      toast.success('Thanks — we\'ll be in touch within one business day.');
      setSent(true);
      reset();
    } catch (e) {
      toast.error('Could not send. Please try again in a moment.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    'w-full bg-bg hairline rounded-btn px-3.5 py-2.5 text-[14px] text-white placeholder-muted/60 focus:outline-none focus:border-accent/50 transition-colors';

  return (
    <div>
      <section className="max-w-7xl mx-auto px-5 lg:px-8 pt-20 pb-16" data-testid="contact-hero">
        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5">
            <Reveal>
              <p className="overline">Contact</p>
              <h1 className="mt-3 text-[36px] sm:text-[48px] lg:text-[54px] font-medium tracking-tightest leading-[1.05] text-white">
                Book a 20-minute demo.
              </h1>
              <p className="mt-5 text-[15px] text-muted leading-relaxed">
                Show us your last three months of transactions and we&apos;ll show you your P10/P50/P90 runway in twenty minutes — on the call.
              </p>
            </Reveal>

            <Reveal delay={0.08} className="mt-10 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-btn bg-surface hairline flex items-center justify-center shrink-0">
                  <Calendar size={14} className="text-accent" />
                </div>
                <div>
                  <p className="text-[13.5px] text-white">Book a live call</p>
                  <p className="text-[12.5px] text-muted mt-0.5">Twenty minutes. Founder-to-founder.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-btn bg-surface hairline flex items-center justify-center shrink-0">
                  <Mail size={14} className="text-accent" />
                </div>
                <div>
                  <p className="text-[13.5px] text-white">hello@clearcash.io</p>
                  <p className="text-[12.5px] text-muted mt-0.5">Reply within one business day.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-btn bg-surface hairline flex items-center justify-center shrink-0">
                  <MapPin size={14} className="text-accent" />
                </div>
                <div>
                  <p className="text-[13.5px] text-white">Bangalore · Singapore</p>
                  <p className="text-[12.5px] text-muted mt-0.5">Remote-first team across 5 timezones.</p>
                </div>
              </div>
            </Reveal>
          </div>

          <div className="lg:col-span-7">
            <Reveal delay={0.05}>
              <div className="bg-surface hairline rounded-card p-7 sm:p-9" data-testid="contact-form-card">
                {sent ? (
                  <div className="py-8 text-center" data-testid="contact-success-panel">
                    <div className="w-11 h-11 mx-auto rounded-full hairline bg-elevated flex items-center justify-center">
                      <CheckCircle2 size={18} className="text-positive" />
                    </div>
                    <h3 className="mt-5 text-[20px] font-medium text-white">You&apos;re on the list.</h3>
                    <p className="mt-2 text-[13.5px] text-muted max-w-sm mx-auto">
                      Thanks for the note. A founder from our team will reply within one business day with a calendar link.
                    </p>
                    <button
                      onClick={() => setSent(false)}
                      className="mt-6 text-[13px] text-accent hover:text-white transition-colors inline-flex items-center gap-1.5"
                      data-testid="contact-send-another"
                    >
                      Send another message
                      <ArrowRight size={13} />
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <Field label="Name" error={errors.name?.message}>
                        <input
                          {...register('name')}
                          className={inputCls}
                          placeholder="Jane Doe"
                          data-testid="contact-input-name"
                        />
                      </Field>
                      <Field label="Work email" error={errors.email?.message}>
                        <input
                          {...register('email')}
                          type="email"
                          className={inputCls}
                          placeholder="jane@company.com"
                          data-testid="contact-input-email"
                        />
                      </Field>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <Field label="Company" error={errors.company?.message}>
                        <input
                          {...register('company')}
                          className={inputCls}
                          placeholder="Acme Inc."
                          data-testid="contact-input-company"
                        />
                      </Field>
                      <Field label="Team size" error={errors.team_size?.message}>
                        <select
                          {...register('team_size')}
                          className={inputCls + ' appearance-none'}
                          data-testid="contact-input-team-size"
                          defaultValue=""
                        >
                          <option value="" disabled>Select…</option>
                          {teamSizes.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <Field label="What are you hoping to solve?" error={errors.message?.message}>
                      <textarea
                        {...register('message')}
                        rows={5}
                        className={inputCls + ' resize-none'}
                        placeholder="A short note — where you're stuck, what you've tried."
                        data-testid="contact-input-message"
                      />
                    </Field>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
                      <p className="text-[11.5px] text-muted">
                        By submitting, you agree to our privacy policy. No spam. No newsletters.
                      </p>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="inline-flex items-center gap-1.5 bg-accent text-bg text-[13.5px] font-medium px-5 py-2.5 rounded-btn hover:bg-[#f0b25c] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        data-testid="contact-submit-btn"
                      >
                        {submitting ? 'Sending…' : 'Book a 20-min demo'}
                        {!submitting && <ArrowRight size={14} />}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <label className="block">
      <span className="overline block mb-2">{label}</span>
      {children}
      {error && (
        <span className="mt-1.5 block text-[11.5px] text-negative" data-testid="contact-field-error">
          {error}
        </span>
      )}
    </label>
  );
}
