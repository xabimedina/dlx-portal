import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Pantalla de "Acceso Restringido" compartida por todas las subpáginas de
 * proyecto. Antes cada página llevaba su propia copia del mismo bloque, con
 * derivas de estilo entre copias (p. ej. clases inexistentes como
 * border-zinc-150); esta es la única versión.
 */
export function AccessRestricted({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950 p-6">
      <Card className="max-w-md w-full border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 text-center space-y-4 shadow-xl bg-white dark:bg-zinc-900">
        <Lock className="h-12 w-12 text-amber-500 bg-amber-500/10 p-2.5 rounded-full mx-auto animate-pulse" />
        <CardHeader className="p-0">
          <CardTitle className="text-lg font-bold text-zinc-900 dark:text-white">Acceso Restringido</CardTitle>
          <CardDescription className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">{message}</CardDescription>
        </CardHeader>
        <CardContent className="p-0 pt-2">
          <p className="text-xs text-zinc-600 dark:text-zinc-500 leading-relaxed font-light">
            Para proteger tu privacidad, esta sección requiere permisos específicos asociados al propietario de la obra.
          </p>
        </CardContent>
        <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4 flex justify-center">
          <Link href="/dashboard">
            <Button className="text-[11px] font-semibold uppercase tracking-[0.12em] bg-zinc-900 text-white hover:bg-zinc-800 h-9">
              Volver al Dashboard
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
