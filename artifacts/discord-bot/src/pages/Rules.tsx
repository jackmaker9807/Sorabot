import { useState } from "react";
import {
  useListRules,
  useCreateRule,
  useUpdateRule,
  useDeleteRule,
  useToggleRule,
  getListRulesQueryKey,
  Rule,
  RuleInputMatchType
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Trash2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Rules() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: rules, isLoading } = useListRules();
  const [search, setSearch] = useState("");
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);

  const [keyword, setKeyword] = useState("");
  const [response, setResponse] = useState("");
  const [matchType, setMatchType] = useState<RuleInputMatchType>(RuleInputMatchType.exact);
  const [caseSensitive, setCaseSensitive] = useState(false);

  const createRule = useCreateRule({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRulesQueryKey() });
        setIsAddOpen(false);
        resetForm();
        toast({ title: "Rule created successfully" });
      }
    }
  });

  const updateRule = useUpdateRule({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRulesQueryKey() });
        setIsEditOpen(false);
        resetForm();
        toast({ title: "Rule updated successfully" });
      }
    }
  });

  const deleteRule = useDeleteRule({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRulesQueryKey() });
        toast({ title: "Rule deleted" });
      }
    }
  });

  const toggleRule = useToggleRule({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRulesQueryKey() });
      }
    }
  });

  const resetForm = () => {
    setKeyword("");
    setResponse("");
    setMatchType(RuleInputMatchType.exact);
    setCaseSensitive(false);
    setEditingRule(null);
  };

  const handleEditClick = (rule: Rule) => {
    setEditingRule(rule);
    setKeyword(rule.keyword);
    setResponse(rule.response);
    setMatchType(rule.matchType as RuleInputMatchType);
    setCaseSensitive(rule.caseSensitive);
    setIsEditOpen(true);
  };

  const handleSave = () => {
    if (!keyword || !response) return;
    if (editingRule) {
      updateRule.mutate({
        id: editingRule.id,
        data: { keyword, response, matchType, caseSensitive }
      });
    } else {
      createRule.mutate({
        data: { keyword, response, matchType, caseSensitive }
      });
    }
  };

  const filteredRules = rules?.filter(r => 
    r.keyword.toLowerCase().includes(search.toLowerCase()) || 
    r.response.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rules Engine</h1>
          <p className="text-muted-foreground mt-1">Configure keywords and automated responses.</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={(open) => {
          setIsAddOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Add Rule</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Auto-Response Rule</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Trigger Keyword / Phrase</Label>
                <Input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="e.g. !help" />
              </div>
              <div className="space-y-2">
                <Label>Bot Response</Label>
                <Input value={response} onChange={e => setResponse(e.target.value)} placeholder="What should the bot say?" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Match Type</Label>
                  <Select value={matchType} onValueChange={(v: RuleInputMatchType) => setMatchType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exact">Exact Match</SelectItem>
                      <SelectItem value="contains">Contains</SelectItem>
                      <SelectItem value="startsWith">Starts With</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2 pt-8">
                  <Switch id="case-add" checked={caseSensitive} onCheckedChange={setCaseSensitive} />
                  <Label htmlFor="case-add">Case Sensitive</Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={createRule.isPending || !keyword || !response}>
                Save Rule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Trigger Keyword / Phrase</Label>
              <Input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="e.g. !help" />
            </div>
            <div className="space-y-2">
              <Label>Bot Response</Label>
              <Input value={response} onChange={e => setResponse(e.target.value)} placeholder="What should the bot say?" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Match Type</Label>
                <Select value={matchType} onValueChange={(v: RuleInputMatchType) => setMatchType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exact">Exact Match</SelectItem>
                    <SelectItem value="contains">Contains</SelectItem>
                    <SelectItem value="startsWith">Starts With</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2 pt-8">
                <Switch id="case-edit" checked={caseSensitive} onCheckedChange={setCaseSensitive} />
                <Label htmlFor="case-edit">Case Sensitive</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={updateRule.isPending || !keyword || !response}>
              Update Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search rules..." 
              className="pl-9 bg-background/50 border-border/50" 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        <Table>
          <TableHeader className="bg-secondary/20">
            <TableRow>
              <TableHead className="w-[80px]">Status</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Response</TableHead>
              <TableHead className="w-[120px]">Type</TableHead>
              <TableHead className="w-[100px] text-right">Triggers</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Loading rules...
                </TableCell>
              </TableRow>
            ) : filteredRules?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No rules found. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              filteredRules?.map(rule => (
                <TableRow key={rule.id} className="group transition-colors">
                  <TableCell>
                    <Switch 
                      checked={rule.enabled} 
                      onCheckedChange={() => toggleRule.mutate({ id: rule.id })}
                      disabled={toggleRule.isPending}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-sm font-medium bg-secondary/50 px-2 py-1 rounded inline-block text-primary">
                      {rule.keyword}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[300px] truncate text-muted-foreground">
                    {rule.response}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal text-xs uppercase tracking-wider bg-background">
                      {rule.matchType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {rule.triggerCount.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleEditClick(rule)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => deleteRule.mutate({ id: rule.id })}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
