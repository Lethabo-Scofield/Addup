import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { useJoinWaitlist, useGetWaitlistStats, getGetWaitlistStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2 } from "lucide-react";

const waitlistSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  company: z.string().optional(),
  role: z.string().optional(),
});

type WaitlistFormValues = z.infer<typeof waitlistSchema>;

export function WaitlistSection() {
  const queryClient = useQueryClient();
  const [isSuccess, setIsSuccess] = useState(false);
  
  const { data: stats } = useGetWaitlistStats({ 
    query: { queryKey: getGetWaitlistStatsQueryKey() } 
  });
  
  const joinMutation = useJoinWaitlist();

  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<WaitlistFormValues>({
    resolver: zodResolver(waitlistSchema)
  });

  const onSubmit = async (data: WaitlistFormValues) => {
    try {
      await joinMutation.mutateAsync({
        data: {
          email: data.email,
          company: data.company || null,
          role: data.role || null
        }
      });
      setIsSuccess(true);
      queryClient.invalidateQueries({ queryKey: getGetWaitlistStatsQueryKey() });
    } catch (error: any) {
      if (error?.status === 409) {
        setError("email", { message: "Already on the waitlist" });
      } else if (error?.status === 400) {
        setError("email", { message: "Please enter a valid email address" });
      } else {
        setError("root", { message: "Something went wrong. Please try again." });
      }
    }
  };

  return (
    <section id="waitlist" className="py-16 sm:py-24 bg-primary text-primary-foreground relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent pointer-events-none" />
      
      <div className="mx-auto max-w-3xl px-6 lg:px-8 relative z-10">
        <div className="text-center mb-8 sm:mb-10">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-3 sm:mb-4">
            Get early access to Addup.
          </h2>
          {stats?.total && stats.total > 0 ? (
            <p className="text-primary-foreground/70 text-base sm:text-lg">
              Join {stats.total}+ finance teams already on the waitlist.
            </p>
          ) : null}
        </div>

        <div className="bg-background/5 p-1 rounded-2xl backdrop-blur-md border border-white/10 shadow-2xl max-w-md mx-auto">
          <div className="bg-card text-card-foreground rounded-xl p-6 sm:p-8">
            {isSuccess ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8"
              >
                <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">You're on the list.</h3>
                <p className="text-sm text-muted-foreground">
                  We'll reach out as early access opens up. Keep an eye on your inbox.
                </p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground">Work Email <span className="text-destructive">*</span></Label>
                  <Input 
                    id="email" 
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="jane@company.com" 
                    {...register("email")}
                    className={`h-11 ${errors.email ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  />
                  {errors.email && (
                    <p className="text-xs text-destructive mt-1">{errors.email.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company" className="text-xs font-semibold text-muted-foreground">Company Name</Label>
                    <Input id="company" placeholder="Acme Inc." autoComplete="organization" className="h-11" {...register("company")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role" className="text-xs font-semibold text-muted-foreground">Role</Label>
                    <Input id="role" placeholder="Controller" autoComplete="organization-title" className="h-11" {...register("role")} />
                  </div>
                </div>

                {errors.root && (
                  <p className="text-xs text-destructive text-center">{errors.root.message}</p>
                )}

                <Button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className="w-full mt-2"
                  size="lg"
                >
                  {isSubmitting ? "Joining..." : "Join waitlist"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
