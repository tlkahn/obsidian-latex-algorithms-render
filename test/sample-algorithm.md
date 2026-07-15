# LaTeX Algorithms Render - Test File

This file contains sample ` ```latex-algorithm` blocks for testing the plugin.

---

## Simple algorithm

```latex-algorithm
\begin{algorithm}
\caption{Find maximum element}
\begin{algorithmic}
\STATE $max \gets a[1]$
\FOR{$i = 2$ to $n$}
  \IF{$a[i] > max$}
    \STATE $max \gets a[i]$
  \ENDIF
\ENDFOR
\RETURN $max$
\end{algorithmic}
\end{algorithm}
```

---

## Quicksort

```latex-algorithm
\begin{algorithm}
\caption{Quicksort}
\begin{algorithmic}
\PROCEDURE{Quicksort}{$A, lo, hi$}
  \IF{$lo < hi$}
    \STATE $p \gets \textsc{Partition}(A, lo, hi)$
    \STATE $\textsc{Quicksort}(A, lo, p-1)$
    \STATE $\textsc{Quicksort}(A, p+1, hi)$
  \ENDIF
\ENDPROCEDURE
\STATE
\PROCEDURE{Partition}{$A, lo, hi$}
  \STATE $pivot \gets A[hi]$
  \STATE $i \gets lo - 1$
  \FOR{$j \gets lo$ to $hi - 1$}
    \IF{$A[j] \le pivot$}
      \STATE $i \gets i + 1$
      \STATE swap $A[i]$ with $A[j]$
    \ENDIF
  \ENDFOR
  \STATE swap $A[i+1]$ with $A[hi]$
  \RETURN $i + 1$
\ENDPROCEDURE
\end{algorithmic}
\end{algorithm}
```

---

## Dijkstra's algorithm

```latex-algorithm
\begin{algorithm}
\caption{Dijkstra's shortest path}
\begin{algorithmic}
\STATE $\textsc{Initialize-Single-Source}(G, s)$
\STATE $S \gets \emptyset$
\STATE $Q \gets G.V$
\WHILE{$Q \neq \emptyset$}
  \STATE $u \gets \textsc{Extract-Min}(Q)$
  \STATE $S \gets S \cup \{u\}$
  \FOR{each vertex $v \in G.Adj[u]$}
    \STATE $\textsc{Relax}(u, v, w)$
  \ENDFOR
\ENDWHILE
\end{algorithmic}
\end{algorithm}
```

---

## Algorithm with mathematical notation

```latex-algorithm
\begin{algorithm}
\caption{Matrix multiplication}
\begin{algorithmic}
\REQUIRE $A \in \mathbb{R}^{m \times n}$, $B \in \mathbb{R}^{n \times p}$
\ENSURE $C \in \mathbb{R}^{m \times p}$
\FOR{$i \gets 1$ to $m$}
  \FOR{$j \gets 1$ to $p$}
    \STATE $C[i,j] \gets 0$
    \FOR{$k \gets 1$ to $n$}
      \STATE $C[i,j] \gets C[i,j] + A[i,k] \cdot B[k,j]$
    \ENDFOR
  \ENDFOR
\ENDFOR
\RETURN $C$
\end{algorithmic}
\end{algorithm}
```

---

## Variant tag: latex-algorithmic

```latex-algorithmic
\begin{algorithmic}
\STATE $x \gets 1$
\WHILE{$x < 1000$}
  \STATE $x \gets 2x$
  \IF{$x > 500$}
    \BREAK
  \ENDIF
\ENDWHILE
\end{algorithmic}
```

---

## Empty body block (should show placeholder or error)

```latex-algorithm


```

---

## Syntax error (should show inline error)

```latex-algorithm
\begin{algorithm}
\caption{Broken}
\begin{algorithmic}
\UNDEFINEDCOMMAND{hello}
\end{algorithmic}
\end{algorithm}
```
