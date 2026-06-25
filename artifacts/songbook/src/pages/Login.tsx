import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLogin } from "@workspace/api-client-react";
import { useAppStore } from "@/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Music } from "lucide-react";

const loginSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

export default function Login() {
  const { setToken } = useAppStore();
  const { toast } = useToast();
  const loginMutation = useLogin();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      password: "",
    },
  });

  function onSubmit(values: z.infer<typeof loginSchema>) {
    loginMutation.mutate(
      { data: values },
      {
        onSuccess: (res) => {
          if (res.token) {
            localStorage.setItem("songbook_token", res.token);
            setToken(res.token);
            toast({
              title: "Welcome to SongBook",
              description: "Successfully logged in.",
            });
          }
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Login failed",
            description: "Incorrect password. Please try again.",
          });
        },
      }
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Music className="w-10 h-10" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">SongBook</h1>
          <p className="text-muted-foreground text-center">
            Shared chord & lyrics library for live musicians
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Enter password..."
                      className="h-14 text-lg text-center"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-center" />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              size="lg"
              className="w-full h-14 text-lg"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? "Entering..." : "Enter Stage"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}