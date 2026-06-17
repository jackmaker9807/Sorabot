import { useState } from "react";
import { useListLogs } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Bot, Search, Terminal, Radio } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function Logs() {
  const [search, setSearch] = useState("");
  const { data: logs, isLoading } = useListLogs({ limit: 100 });

  const filteredLogs = logs?.filter(log => 
    log.authorUsername.toLowerCase().includes(search.toLowerCase()) ||
    log.triggerMessage.toLowerCase().includes(search.toLowerCase()) ||
    log.botResponse.toLowerCase().includes(search.toLowerCase()) ||
    log.channelName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 fade-in h-full flex flex-col">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Message Logs</h1>
          <p className="text-muted-foreground mt-1">History of bot interactions across all servers.</p>
        </div>
        <Badge variant="outline" className="flex items-center gap-1.5 text-green-500 border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-semibold">
          <Radio className="w-3 h-3 animate-pulse" />
          Real-time
        </Badge>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm flex flex-col min-h-0 flex-1">
        <div className="p-4 border-b border-border shrink-0">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Filter logs by user, message, or channel..." 
              className="pl-9 bg-background/50 border-border/50" 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        <div className="overflow-auto flex-1 min-h-[500px]">
          <Table>
            <TableHeader className="bg-secondary/20 sticky top-0 z-10 backdrop-blur">
              <TableRow>
                <TableHead className="w-[180px]">Timestamp</TableHead>
                <TableHead className="w-[200px]">Context</TableHead>
                <TableHead>User Message</TableHead>
                <TableHead>Bot Response</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    Loading logs...
                  </TableCell>
                </TableRow>
              ) : filteredLogs?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Terminal className="h-8 w-8 mb-2 opacity-50" />
                      <p>No matching logs found.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs?.map(log => (
                  <TableRow key={log.id} className="hover:bg-secondary/10">
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.createdAt), "MMM d, yyyy")}
                      <br/>
                      {format(new Date(log.createdAt), "h:mm:ss a")}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="font-medium text-primary text-sm truncate max-w-[180px]">
                          @{log.authorUsername}
                        </div>
                        <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                          #{log.channelName} {log.guildName && <span className="opacity-50">· {log.guildName}</span>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm bg-background border border-border/50 rounded-md p-2 text-foreground/80 max-w-[300px] md:max-w-md break-words">
                        {log.triggerMessage}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm bg-primary/5 border border-primary/20 rounded-md p-2 text-foreground max-w-[300px] md:max-w-md break-words flex gap-2 items-start">
                        <Bot className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{log.botResponse}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
