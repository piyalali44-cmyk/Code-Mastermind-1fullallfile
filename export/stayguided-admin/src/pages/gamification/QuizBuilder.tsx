import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, ChevronRight, HelpCircle, CheckCircle, AlertTriangle, ExternalLink } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useLocation } from "wouter";

interface Quiz { id: string; title: string; description: string | null; category: string | null; is_active: boolean; pass_percentage: number; xp_reward: number; created_at: string; question_count?: number; }
interface Question { id: string; quiz_id: string; question: string; options: string[]; correct_index: number; explanation: string | null; sort_order: number; }

const blankQuiz = (): Partial<Quiz> => ({ title: "", description: "", category: "", is_active: true, pass_percentage: 60, xp_reward: 50 });
const blankQuestion = (quizId: string, order: number): Partial<Question> => ({ quiz_id: quizId, question: "", options: ["", "", "", ""], correct_index: 0, explanation: "", sort_order: order });

export default function QuizBuilder() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [quizForm, setQuizForm] = useState<Partial<Quiz>>(blankQuiz());
  const [editingQuiz, setEditingQuiz] = useState<string | null>(null);
  const [quizSheet, setQuizSheet] = useState(false);
  const [questionForm, setQuestionForm] = useState<Partial<Question> | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null);
  const [questionDialog, setQuestionDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [quizModeEnabled, setQuizModeEnabled] = useState<boolean | null>(null);
  const { profile } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    supabase.from("feature_flags").select("is_enabled").eq("key", "quiz_mode").single().then(({ data }) => {
      setQuizModeEnabled(data ? data.is_enabled : false);
    });
  }, []);

  async function toggleQuizMode() {
    const newVal = !quizModeEnabled;
    const { error } = await supabase.from("feature_flags").update({ is_enabled: newVal, updated_at: new Date().toISOString() }).eq("key", "quiz_mode");
    if (!error) {
      setQuizModeEnabled(newVal);
      toast.success(`Quiz mode ${newVal ? "enabled" : "disabled"}`);
    } else {
      toast.error("Failed to update quiz mode");
    }
  }

  async function loadQuizzes() {
    setLoading(true);
    const { data } = await supabase.from("quizzes").select("*").order("created_at", { ascending: false });
    const ids = (data || []).map((q: Quiz) => q.id);
    let counts: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: qData } = await supabase.from("quiz_questions").select("quiz_id");
      (qData || []).forEach((q: { quiz_id: string }) => { counts[q.quiz_id] = (counts[q.quiz_id] || 0) + 1; });
    }
    setQuizzes((data || []).map((q: Quiz) => ({ ...q, question_count: counts[q.id] || 0 })));
    setLoading(false);
  }

  async function loadQuestions(quizId: string) {
    const { data } = await supabase.from("quiz_questions").select("*").eq("quiz_id", quizId).order("sort_order");
    setQuestions(data ?? []);
  }

  useEffect(() => { loadQuizzes(); }, []);
  useEffect(() => { if (activeQuiz) loadQuestions(activeQuiz.id); }, [activeQuiz]);

  function openNewQuiz() { setQuizForm(blankQuiz()); setEditingQuiz(null); setQuizSheet(true); }
  function openEditQuiz(q: Quiz) { setQuizForm({ ...q }); setEditingQuiz(q.id); setQuizSheet(true); }

  async function saveQuiz() {
    if (!quizForm.title?.trim()) return void toast.error("Title required");
    setSaving(true);
    try {
      const payload = { title: quizForm.title, description: quizForm.description, category: quizForm.category, is_active: quizForm.is_active, pass_percentage: quizForm.pass_percentage ?? 60, xp_reward: quizForm.xp_reward ?? 50 };
      if (editingQuiz) {
        const { error } = await supabase.from("quizzes").update(payload).eq("id", editingQuiz);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("quizzes").insert(payload);
        if (error) throw error;
      }
      toast.success(editingQuiz ? "Quiz updated" : "Quiz created");
      setQuizSheet(false);
      loadQuizzes();
    } catch (err: unknown) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  }

  async function deleteQuiz(q: Quiz) {
    await supabase.from("quizzes").delete().eq("id", q.id);
    toast.success("Quiz deleted");
    if (activeQuiz?.id === q.id) setActiveQuiz(null);
    loadQuizzes();
  }

  function openNewQuestion() {
    if (!activeQuiz) return;
    setQuestionForm(blankQuestion(activeQuiz.id, questions.length));
    setEditingQuestion(null);
    setQuestionDialog(true);
  }

  function openEditQuestion(q: Question) {
    setQuestionForm({ ...q, options: [...q.options] });
    setEditingQuestion(q.id);
    setQuestionDialog(true);
  }

  async function saveQuestion() {
    if (!questionForm?.question?.trim()) return void toast.error("Question text required");
    const opts = (questionForm.options || []).filter((o: string) => o.trim());
    if (opts.length < 2) return void toast.error("At least 2 options required");
    setSaving(true);
    try {
      const payload = { quiz_id: questionForm.quiz_id, question: questionForm.question, options: questionForm.options, correct_index: questionForm.correct_index ?? 0, explanation: questionForm.explanation || null, sort_order: questionForm.sort_order ?? 0 };
      if (editingQuestion) {
        const { error } = await supabase.from("quiz_questions").update(payload).eq("id", editingQuestion);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("quiz_questions").insert(payload);
        if (error) throw error;
      }
      toast.success(editingQuestion ? "Question updated" : "Question added");
      setQuestionDialog(false);
      if (activeQuiz) loadQuestions(activeQuiz.id);
      loadQuizzes();
    } catch (err: unknown) { toast.error((err as Error).message); }
    finally { setSaving(false); }
  }

  async function deleteQuestion(q: Question) {
    await supabase.from("quiz_questions").delete().eq("id", q.id);
    toast.success("Question deleted");
    if (activeQuiz) loadQuestions(activeQuiz.id);
    loadQuizzes();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2"><HelpCircle className="h-6 w-6 text-primary" />Quiz Builder</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{quizzes.length} quizzes total</p>
        </div>
      </div>

      {/* Quiz Mode toggle banner */}
      <div className={`flex items-center justify-between rounded-xl border px-4 py-3 ${quizModeEnabled ? "bg-green-500/10 border-green-500/30" : "bg-yellow-500/10 border-yellow-500/30"}`}>
        <div className="flex items-center gap-3">
          {quizModeEnabled
            ? <CheckCircle className="h-5 w-5 text-green-400 shrink-0" />
            : <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0" />}
          <div>
            <p className={`text-sm font-semibold ${quizModeEnabled ? "text-green-400" : "text-yellow-400"}`}>
              Quiz Mode is {quizModeEnabled === null ? "loading…" : quizModeEnabled ? "ON" : "OFF"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {quizModeEnabled
                ? "Quizzes are visible to users in the mobile app."
                : "Quizzes are hidden from users. Toggle to make them visible."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Switch checked={!!quizModeEnabled} onCheckedChange={toggleQuizMode} disabled={quizModeEnabled === null} />
          <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate("/settings/feature-flags")}>
            <ExternalLink className="h-3.5 w-3.5" />All flags
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
        </div>
        <Sheet open={quizSheet} onOpenChange={setQuizSheet}>
          <SheetTrigger asChild><Button onClick={openNewQuiz}><Plus className="h-4 w-4 mr-2" />New Quiz</Button></SheetTrigger>
          <SheetContent className="w-[420px]">
            <SheetHeader><SheetTitle>{editingQuiz ? "Edit Quiz" : "New Quiz"}</SheetTitle></SheetHeader>
            <div className="space-y-4 mt-6">
              <div className="space-y-1"><Label>Title *</Label><Input value={quizForm.title || ""} onChange={e => setQuizForm(f => ({ ...f, title: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Category</Label><Input value={quizForm.category || ""} onChange={e => setQuizForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Seerah, Qur'an" /></div>
              <div className="space-y-1"><Label>Description</Label><Textarea rows={2} value={quizForm.description || ""} onChange={e => setQuizForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1"><Label>Pass % (min correct)</Label><Input type="number" min={0} max={100} value={quizForm.pass_percentage ?? 60} onChange={e => setQuizForm(f => ({ ...f, pass_percentage: parseInt(e.target.value) || 60 }))} /></div>
                <div className="space-y-1"><Label>XP Reward</Label><Input type="number" min={0} value={quizForm.xp_reward ?? 50} onChange={e => setQuizForm(f => ({ ...f, xp_reward: parseInt(e.target.value) || 0 }))} /></div>
              </div>
              <div className="flex items-center gap-2"><Switch id="q-active" checked={!!quizForm.is_active} onCheckedChange={v => setQuizForm(f => ({ ...f, is_active: v }))} /><Label htmlFor="q-active">Active</Label></div>
              <div className="flex gap-3 pt-2">
                <Button className="flex-1" onClick={saveQuiz} disabled={saving}>{saving ? "Saving…" : editingQuiz ? "Save" : "Create"}</Button>
                <Button variant="outline" onClick={() => setQuizSheet(false)}>Cancel</Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Quiz</TableHead><TableHead>Qs</TableHead><TableHead>XP</TableHead><TableHead /></TableRow>
            </TableHeader>
            <TableBody>
              {loading ? Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 4 }).map((__, j) => <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded" /></TableCell>)}</TableRow>
              )) : quizzes.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No quizzes yet</TableCell></TableRow>
              ) : quizzes.map(q => (
                <TableRow key={q.id} className={`cursor-pointer ${activeQuiz?.id === q.id ? "bg-primary/5" : "hover:bg-muted/30"}`} onClick={() => setActiveQuiz(q)}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {activeQuiz?.id === q.id && <ChevronRight className="h-3 w-3 text-primary" />}
                      <div>
                        <div className="font-medium text-sm">{q.title}</div>
                        {q.category && <div className="text-xs text-muted-foreground">{q.category}</div>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{q.question_count}</TableCell>
                  <TableCell className="text-sm text-primary">+{q.xp_reward}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); openEditQuiz(q); }}><Edit2 className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={e => { e.stopPropagation(); deleteQuiz(q); }}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </Card>

        <div className="space-y-3">
          {!activeQuiz ? (
            <Card className="flex items-center justify-center h-48 text-muted-foreground text-sm">Select a quiz to manage its questions</Card>
          ) : (
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">{activeQuiz.title} — Questions</CardTitle>
                <Button size="sm" onClick={openNewQuestion}><Plus className="h-3 w-3 mr-1" />Add</Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {questions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No questions yet</p>
                ) : questions.map((q, idx) => (
                  <div key={q.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/20 hover:bg-muted/40 group">
                    <span className="text-xs font-mono text-muted-foreground mt-0.5 w-5 shrink-0">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{q.question}</p>
                      <p className="text-xs text-muted-foreground">{q.options.length} options · Correct: #{q.correct_index + 1}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditQuestion(q)}><Edit2 className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteQuestion(q)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={questionDialog} onOpenChange={o => !o && setQuestionDialog(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingQuestion ? "Edit Question" : "Add Question"}</DialogTitle>
            <DialogDescription>{editingQuestion ? "Update the quiz question details below." : "Fill in the details to add a new quiz question."}</DialogDescription>
          </DialogHeader>
          {questionForm && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Question *</Label>
                <Textarea rows={2} value={questionForm.question || ""} onChange={e => setQuestionForm(f => f ? ({ ...f, question: e.target.value }) : f)} />
              </div>
              <div className="space-y-2">
                <Label>Options (mark the correct one)</Label>
                {(questionForm.options || ["","","",""]).map((opt: string, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <button
                      onClick={() => setQuestionForm(f => f ? ({ ...f, correct_index: i }) : f)}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${questionForm.correct_index === i ? "border-primary bg-primary/20" : "border-border"}`}
                    >
                      {questionForm.correct_index === i && <CheckCircle className="h-3 w-3 text-primary" />}
                    </button>
                    <Input
                      value={opt}
                      onChange={e => {
                        const newOpts = [...(questionForm.options || ["","","",""])];
                        newOpts[i] = e.target.value;
                        setQuestionForm(f => f ? ({ ...f, options: newOpts }) : f);
                      }}
                      placeholder={`Option ${i + 1}`}
                    />
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">Click the circle to mark the correct answer</p>
              </div>
              <div className="space-y-1">
                <Label>Explanation (shown after answer)</Label>
                <Textarea rows={2} value={questionForm.explanation || ""} onChange={e => setQuestionForm(f => f ? ({ ...f, explanation: e.target.value }) : f)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuestionDialog(false)}>Cancel</Button>
            <Button onClick={saveQuestion} disabled={saving}>{saving ? "Saving…" : editingQuestion ? "Save" : "Add Question"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
