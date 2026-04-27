import React, { createContext, useCallback, useContext, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import {
  useJoinWaitlist,
  getGetWaitlistStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2 } from "lucide-react";

const waitlistSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  fullName: z.string().min(1, "Please enter your name").max(120),
  company: z.string().min(1, "Please enter your company name").max(160),
  role: z.string().min(1, "Please enter your role").max(120),
  companySize: z.string().optional(),
  country: z.string().optional(),
  notes: z.string().max(500).optional(),
});

type WaitlistFormValues = z.infer<typeof waitlistSchema>;

const sizeOptions = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "500+",
];

type WaitlistContextValue = {
  open: () => void;
  close: () => void;
  isOpen: boolean;
};

const WaitlistContext = createContext<WaitlistContextValue | null>(null);

export function useWaitlist(): WaitlistContextValue {
  const ctx = useContext(WaitlistContext);
  if (!ctx) {
    throw new Error("useWaitlist must be used within <WaitlistProvider>");
  }
  return ctx;
}

export function WaitlistProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <WaitlistContext.Provider value={{ open, close, isOpen }}>
      {children}
      <WaitlistDialog isOpen={isOpen} onOpenChange={setIsOpen} />
    </WaitlistContext.Provider>
  );
}

function WaitlistDialog({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [isSuccess, setIsSuccess] = useState(false);
  const joinMutation = useJoinWaitlist();
  const [companySize, setCompanySize] = useState<string>("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    reset,
  } = useForm<WaitlistFormValues>({
    resolver: zodResolver(waitlistSchema),
  });

  const handleClose = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      // small delay so the closing animation isn't visually disrupted
      setTimeout(() => {
        setIsSuccess(false);
        setCompanySize("");
        reset();
      }, 200);
    }
  };

  const onSubmit = async (data: WaitlistFormValues) => {
    // The current API persists email, company, role only.
    // We pack the additional company details into the role field so nothing is lost.
    const extras: string[] = [];
    if (data.fullName) extras.push(`Name: ${data.fullName}`);
    if (data.role) extras.push(`Role: ${data.role}`);
    if (companySize) extras.push(`Size: ${companySize}`);
    if (data.country?.trim()) extras.push(`Country: ${data.country.trim()}`);
    if (data.notes?.trim()) extras.push(`Notes: ${data.notes.trim()}`);

    try {
      await joinMutation.mutateAsync({
        data: {
          email: data.email,
          company: data.company || null,
          role: extras.join(" | ") || null,
        },
      });
      setIsSuccess(true);
      queryClient.invalidateQueries({ queryKey: getGetWaitlistStatsQueryKey() });
    } catch (error: unknown) {
      const status = (error as { status?: number })?.status;
      if (status === 409) {
        setError("email", { message: "This email is already on the waitlist" });
      } else if (status === 400) {
        setError("email", { message: "Please enter a valid email address" });
      } else {
        setError("root", { message: "Something went wrong. Please try again." });
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden rounded-3xl">
        <div className="px-6 sm:px-8 pt-7 sm:pt-8 pb-2">
          <DialogHeader>
            <DialogTitle className="text-2xl sm:text-[28px] font-semibold tracking-tight">
              {isSuccess ? "You're on the list." : "Join the waitlist"}
            </DialogTitle>
            <DialogDescription className="text-[15px] text-muted-foreground">
              {isSuccess
                ? "We'll reach out as early access opens up."
                : "Tell us a bit about your company so we can prioritise the right finance teams."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 sm:px-8 pb-7 sm:pb-8">
          {isSuccess ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-6"
            >
              <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              </div>
              <p className="text-sm text-muted-foreground">
                Keep an eye on your inbox.
              </p>
              <Button
                onClick={() => handleClose(false)}
                className="mt-6 rounded-full h-11 px-6 text-[14px] font-medium"
              >
                Close
              </Button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Field
                id="fullName"
                label="Full name"
                required
                error={errors.fullName?.message}
              >
                <Input
                  id="fullName"
                  autoComplete="name"
                  placeholder="Jane Khumalo"
                  className="h-11"
                  {...register("fullName")}
                />
              </Field>

              <Field
                id="email"
                label="Work email"
                required
                error={errors.email?.message}
              >
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="jane@company.com"
                  className="h-11"
                  {...register("email")}
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  id="company"
                  label="Company"
                  required
                  error={errors.company?.message}
                >
                  <Input
                    id="company"
                    autoComplete="organization"
                    placeholder="Acme Pty Ltd"
                    className="h-11"
                    {...register("company")}
                  />
                </Field>
                <Field
                  id="role"
                  label="Role"
                  required
                  error={errors.role?.message}
                >
                  <Input
                    id="role"
                    autoComplete="organization-title"
                    placeholder="Financial Controller"
                    className="h-11"
                    {...register("role")}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field id="companySize" label="Company size">
                  <Select
                    value={companySize}
                    onValueChange={setCompanySize}
                  >
                    <SelectTrigger id="companySize" className="h-11">
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      {sizeOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt} employees
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field id="country" label="Country">
                  <Input
                    id="country"
                    autoComplete="country-name"
                    placeholder="South Africa"
                    className="h-11"
                    {...register("country")}
                  />
                </Field>
              </div>

              <Field
                id="notes"
                label="What are you hoping Addup solves?"
                error={errors.notes?.message}
              >
                <Textarea
                  id="notes"
                  rows={3}
                  placeholder="Optional"
                  className="resize-none"
                  {...register("notes")}
                />
              </Field>

              {errors.root && (
                <p className="text-xs text-destructive text-center">
                  {errors.root.message}
                </p>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 rounded-full h-12 text-[15px] font-medium"
              >
                {isSubmitting ? "Joining..." : "Request early access"}
              </Button>

              <p className="text-[11px] text-center text-muted-foreground/70 pt-1">
                We'll only use this to confirm your spot and share early-access updates.
              </p>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={id}
        className="text-xs font-semibold text-muted-foreground"
      >
        {label}
        {required ? <span className="text-destructive ml-0.5">*</span> : null}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}
