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
  company: z.string().max(120).optional(),
  role: z.string().max(120).optional(),
});

type WaitlistFormValues = z.infer<typeof waitlistSchema>;

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
      setTimeout(() => {
        setIsSuccess(false);
        reset();
      }, 200);
    }
  };

  const onSubmit = async (data: WaitlistFormValues) => {
    try {
      await joinMutation.mutateAsync({
        data: {
          email: data.email,
          company: data.company?.trim() || null,
          role: data.role?.trim() || null,
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
      <DialogContent className="sm:max-w-md w-[calc(100vw-1.5rem)] p-0 rounded-none gap-0 max-h-[92dvh] flex flex-col overflow-hidden">
        <div className="px-5 sm:px-8 pt-6 sm:pt-8 pb-2 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-[28px] font-semibold tracking-tight pr-6">
              {isSuccess ? "You're on the list." : "Join the waitlist"}
            </DialogTitle>
            <DialogDescription className="text-[14px] sm:text-[15px] text-muted-foreground pr-6">
              {isSuccess
                ? "We'll reach out as early access opens up."
                : "Get early access to Addup. Close your books in minutes, not days."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-5 sm:px-8 pb-6 sm:pb-8 overflow-y-auto flex-1 [-webkit-overflow-scrolling:touch]">
          {isSuccess ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-6"
            >
              <div className="mx-auto w-12 h-12 flex items-center justify-center mb-4 bg-emerald-500/10">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              </div>
              <p className="text-sm text-muted-foreground">
                Keep an eye on your inbox.
              </p>
              <Button
                onClick={() => handleClose(false)}
                className="mt-6 rounded-none h-11 px-6 text-[14px] font-medium"
              >
                Close
              </Button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
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
                  className="h-11 rounded-none"
                  {...register("email")}
                />
              </Field>

              <Field
                id="company"
                label="Company"
                error={errors.company?.message}
              >
                <Input
                  id="company"
                  autoComplete="organization"
                  placeholder="Acme Pty Ltd"
                  className="h-11 rounded-none"
                  {...register("company")}
                />
              </Field>

              <Field
                id="role"
                label="Role"
                error={errors.role?.message}
              >
                <Input
                  id="role"
                  autoComplete="organization-title"
                  placeholder="Financial Controller"
                  className="h-11 rounded-none"
                  {...register("role")}
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
                className="w-full mt-2 rounded-none h-12 text-[15px] font-medium"
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
