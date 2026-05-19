# 정식 규약 준수 검토 — convention_compliance

검토 대상: `plan/in-progress/send-email-to-array-only.md`
검토 모드: plan draft (--plan)
검토 시각: 2026-05-19

---

## 발견사항

### 1.
- **[INFO]** frontmatter `worktree` 값에 slug 없음
  - target 위치: 파일 상단 frontmatter, `worktree: send-email-to-array-only`
  - 위반 규약: `CLAUDE.md §Worktree 기반 작업 정책 §명명 규칙` — worktree 이름은 `<task_name>-<slug>` 형식이어야 한다. 예: `send-email-to-array-only-c41f58`
  - 상세: frontmatter 의 `worktree` 필드 값이 `send-email-to-array-only` 로 slug 부분이 없다. plan 문서의 frontmatter 는 실제 worktree 디렉토리 이름과 일치해야 하며, 규약 상 해당 이름은 `<task_name>-<slug>` 형식이다. 실제 worktree 경로도 `send-email-to-array-only` (slug 없음) 로 확인되는데, 이는 명명 규약 미준수다.
  - 제안: 실제 worktree 디렉토리 이름이 slug 없이 생성된 경우, worktree 자체를 `send-email-to-array-only-<hex>` 로 재생성하거나, 이미 작업이 상당 부분 완료된 경우라면 최소한 frontmatter 의 주석으로 예외 사유를 기록한다. 향후 worktree 생성 시 `ensure-worktree.sh` 를 사용하면 slug 가 자동 부여된다.

### 2.
- **[INFO]** `## 관련 문서` 섹션만 있고 `## Rationale` 섹션 없음
  - target 위치: 문서 끝부분, `## 관련 문서` 이후
  - 위반 규약: `CLAUDE.md §프로젝트 스펙 문서` — `spec/<영역>/N-name.md` 에는 본문 끝에 `## Rationale` 섹션을 **권장**. plan 문서이므로 강제 사항은 아니나, CLAUDE.md 는 spec 문서 외에도 아키텍처 결정 근거를 Rationale 에 두도록 가이드한다.
  - 상세: 본 plan 은 `## 결정 (사용자, 2026-05-19)` 섹션에 결정 근거 4개를 서술하고 있어 내용 자체는 충분하다. 그러나 CLAUDE.md 가 권장하는 `## Rationale` 헤더 대신 `## 결정` 이라는 임의 헤더를 사용하고 있어, 자동 파싱이나 일관성 검사 도구가 Rationale 섹션을 누락된 것으로 오인할 수 있다.
  - 제안: plan 문서이므로 필수는 아니나, `## 결정` 을 `## Rationale` 로 변경하거나 `## 결정` 아래 별도 `## Rationale` 서브섹션을 추가하면 spec 문서 구조 규약과 더 일치한다. 현행 유지도 무방하나 INFO 수준으로 기록.

### 3.
- **[INFO]** plan 내 spec 수정 항목(`spec/4-nodes/4-integration/3-send-email.md`)이 작업 항목 내 인라인 체크박스로만 기재됨
  - target 위치: `## 작업 항목` — `[x] spec/4-nodes/4-integration/3-send-email.md:` 항목
  - 위반 규약: `CLAUDE.md` 의 user memory 항목 — "구현 plan 은 spec 갱신까지 정식 phase 로 포함, '외부 위임' 한 줄로 묶지 말 것"
  - 상세: spec 수정 항목이 구현 체크박스들과 같은 평면 레벨에서 인라인으로 나열되어 있다. user memory 지시는 spec 갱신을 "정식 phase" 로 포함하도록 한다. 현재 `[x]` 로 이미 완료 표시되어 있어 기능적 문제는 없지만, phase 구분이 명시적이지 않다.
  - 제안: 향후 plan 작성 시 구현 phase 와 spec 갱신 phase 를 별도 헤딩(`### Phase 1`, `### Phase 2` 등)으로 구분하는 것을 권장. 이번 plan 은 대부분 완료(`[x]`)된 상태이므로 구조 변경의 실익이 낮다.

---

## 요약

`plan/in-progress/send-email-to-array-only.md` 는 정식 규약의 핵심 요건(frontmatter 필수 3필드 존재, `plan/in-progress/` 위치, `git mv` 완료 지시 포함, 단일 commit 의도 명시 등)을 대체로 준수하고 있다. 발견된 항목은 모두 INFO 등급이며, worktree 명명에서 slug 가 누락된 점(실제 디렉토리도 동일한 상태로 보임), `## Rationale` 헤더 미사용, spec 갱신 phase 명시 미흡이 해당한다. 정식 규약(`spec/conventions/`)의 카탈로그·마이그레이션·Output·Swagger 규약과는 직접 연관이 없는 plan 문서이므로 해당 규약들에 대한 위반은 없다. 전체적으로 규약 준수 수준은 양호하다.

---

## 위험도

LOW
