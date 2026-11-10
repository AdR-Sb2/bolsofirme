<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep personal finance reads owner-scoped; expose connection summaries only through the authenticated, permission-filtered database function so shared rows never mix into personal totals.
- Keep every table and field used by the financial pages in checked-in migrations with authenticated grants and owner policies, so published pages and database stay compatible.
