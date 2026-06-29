# Rationale 연속성 검토 — slack.md / discord.md frontmatter `user_guide` 분리

## 검토 대상

실제 변경 scope (vs `origin/main`): 두 파일 frontmatter 에 `user_guide:` 키 1줄씩 추가.

- `spec/4-nodes/7-trigger/providers/slack.md` — `code:` 리스트 끝의 `slack.mdx` / `slack.en.mdx` 2개 경로 앞에 `user_guide:` 키 삽입 (해당 `.mdx` 경로가 `code:` 에서 `user_guide:` 산하로 재귀속).
- `spec/4-nodes/7-trigger/providers/discord.md` — 동일 패턴 (`discord.mdx` / `discord.en.mdx`).

spec 본문·`## Rationale` 섹션은 무변경. payload 에 첨부된 target 전문(R-S-1 ~ R-S-9 등)은 변경 대상이 아니라 컨텍스트.

## 발견사항

- **[INFO]** frontmatter 변경이 기존 합의 스키마에 정합 (위반 아님)
  - target 위치: `slack.md` / `discord.md` frontmatter `user_guide:` 키 신설
  - 과거 결정 출처: `spec/conventions/spec-impl-evidence.md §2.1` 필드 정의 — `user_guide` = "본 spec 의 가이드 페이지 cross-link" (string[] path, 선택). 동 §2.2 가 `.mdx` 가이드 문서와 `.md` spec code 의 의미 도메인을 명시 구분.
  - 상세: 변경 전 두 파일은 user-guide `.mdx` 경로를 `code:` 리스트에 섞어 두었는데, 이는 §2.1 스키마상 `code:`(구현 surface 경로)가 아니라 `user_guide:`(가이드 cross-link) 슬롯에 속한다. 이번 변경은 그 오귀속을 컨벤션이 정한 슬롯으로 되돌리는 것 — 기각된 대안의 재도입이 아니라 합의 스키마로의 수렴이다. 컨벤션 §2.1 예시 자체가 `user_guide:` 아래에 `...telegram.mdx` 를 두는 형태를 SoT 로 제시한다.
  - 제안: 변경 불필요. 정합 확인용으로만 기록.

## 요약

이번 변경은 `slack.md` / `discord.md` frontmatter 에서 user-guide `.mdx` 경로를 `code:` 에서 `user_guide:` 키로 분리하는 순수 메타데이터 재귀속이다. spec 본문이나 `## Rationale` 의 어떤 결정도 건드리지 않으며, 과거에 기각된 대안의 재도입·합의 원칙 위반·무근거 번복·invariant 우회 어느 것에도 해당하지 않는다. 오히려 `spec/conventions/spec-impl-evidence.md §2.1/§2.2` 가 정의한 frontmatter 스키마(가이드 `.mdx` 는 `user_guide:`, 구현 `.md`/`.ts` surface 는 `code:`)에 명시적으로 수렴하는 정렬 작업이다. Rationale 연속성 관점에서 충돌·번복 없음.

## 위험도

NONE
