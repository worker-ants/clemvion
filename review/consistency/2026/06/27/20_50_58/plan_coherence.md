# Plan 정합성 검토 결과

검토 모드: `--impl-done`, scope=`spec/conventions/cafe24-api-catalog`, diff-base=`origin/main`
검토 대상 plan: `plan/in-progress/cafe24-backlog-residual.md`

---

## 발견사항

### [WARNING] G-2 섹션 미폐쇄 — 제거 완료된 ops 를 여전히 "후속 조치 대기" 로 기술

- **target 위치**: 없음 (spec 자체가 아닌 plan 내 stale 항목)
- **관련 plan**: `plan/in-progress/cafe24-backlog-residual.md` §G-2 ("잔존 docs 부재 ops 처리 결정 (운영 검증 후)")
- **상세**: G-2 섹션은 "production 검증 후 row 제거 또는 cafe24 본사 문의 후 docs 등재 요청. 모두 JSDoc ⚠ 마크 완료. 영향 ops: customer_get/update, coupon_get/delete, applications_list, webhooks_list, mains_update/delete, socials_apple_settings_get" 라고 나열하고 있다. 그러나 G-3l 에서 이 9개 ops 를 2026-06-27 사용자 결정으로 전부 제거했다. G-2 섹션에는 이 결과가 반영되지 않아, G-2 를 읽는 사람은 여전히 후속 조치가 필요한 것으로 오인할 수 있다.
- **제안**: `plan/in-progress/cafe24-backlog-residual.md` G-2 섹션 상단에 "✅ G-3l(2026-06-27) 에서 9 ops 전부 제거 결정 및 완료 — 본 항목 해소됨" 주석을 추가한다. spec 변경 자체는 정합하다.

---

### [INFO] G-3 재검증 이력 노트의 stale 문구

- **target 위치**: 없음 (plan 내부 이력 노트)
- **관련 plan**: `plan/in-progress/cafe24-backlog-residual.md` G-3 체크박스 재검증 (2026-06-20) 노트 — "G-3l 은 planner 미결로 open 유지"
- **상세**: 2026-06-20 재검증 시점에 작성된 이력 블록에 "G-3l 은 planner 미결로 open 유지. 남은 트랙(G-1 field-set·G-3k carts 실증)은 별개로 in-progress" 라는 문장이 남아 있다. G-3l 이 2026-06-27 [x] 로 완료됐으므로 이 문장은 이력 노트로서 stale 하다. 기능적 오작동은 없지만 문서 추적 혼란 가능성이 있다.
- **제안**: 이력 블록의 해당 문장을 "(2026-06-27 G-3l 완료로 정정)" 으로 괄호 표기하거나 삭제한다. plan 우선순위 낮음.

---

### [INFO] G-3m 이력 노트의 KNOWN_DOCS_ABSENT 기술 stale

- **target 위치**: 없음 (plan 내 이력 노트)
- **관련 plan**: `plan/in-progress/cafe24-backlog-residual.md` G-3m 항목 — "G-2 docs-부재 9개는 KNOWN_DOCS_ABSENT allowlist 면제"
- **상세**: G-3l 에서 allowlist 가 9→0 으로 갱신됐음이 G-3l 노트에 명시되어 있으나, G-3m 항목 본문은 여전히 "9개 면제" 로 기술된다. G-3m 는 완료(✅) 된 항목으로, 이 문구는 작성 시점 기준의 이력이다. 실제 동작(allowlist size=0 테스트 pass)은 G-3l 에서 검증됐다.
- **제안**: 추적 메모 수준 — G-3m 의 "9개" 를 "(현재 0, G-3l 제거)" 로 보강 가능하나 의무 아님.

---

## 요약

`spec/conventions/cafe24-api-catalog` 의 이번 변경(G-3l — docs 부재 9 ops 제거)은 plan 내 미해결 결정과의 충돌이 없다. G-3l 은 이전에 "planner 트랙 미결" 로 open 상태였으나, 본 worktree 의 plan 파일에서 "사용자 결정 2026-06-27" 를 명시하고 `[x]` 로 완료 처리했으며, spec 카탈로그 변경(row 제거·coverage 485 갱신)도 정합하게 반영됐다. 다만 G-2 섹션이 "제거 완료" 를 반영하지 않아 동일 plan 을 읽을 때 G-2 내용이 아직 대기 중인 것처럼 보이는 추적 격차가 WARNING 수준으로 존재한다. spec 변경 자체를 차단할 CRITICAL 이슈는 없다.

## 위험도

LOW
