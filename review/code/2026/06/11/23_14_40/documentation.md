# 문서화(Documentation) 리뷰 결과

**리뷰 대상**: HTTP Request 노드 SSRF 가드 전 인증 방식 적용 (refactor 04 C-3)
**검토일**: 2026-06-11
**세션**: `review/code/2026/06/11/23_14_40/`

---

## 발견사항

### - **[WARNING]** `http-request.handler.ts` configEcho 블록의 구 "자동 반영" 주석 — 현재 코드와 완전히 해소됐는지 재확인 필요

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/http-ssrf-all-auth/codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` line 157–162 (configEcho 블록 직전 주석)
- **상세**: 이전 리뷰 세션(23_00_44)에서 "adding a new schema field is automatically echoed without a maintenance step here (review W-6)" 구절이 실제 동작(명시 열거, 자동 반영 불가)과 정반대 진술이라 WARNING으로 지적됐다. 현재 코드를 직접 확인하면 해당 구절은 삭제되었고 "NOTE: adding a new schema field (http-request.schema.ts) requires adding it here too — this manual sync is intentional; it keeps the echo a known, audited surface." 로 교체됐다. 그러나 동일 블록 바로 위(line 157 이전)에 동일 취지의 낡은 문구가 완전히 제거되었는지 한 번 더 확인이 필요하다. 현재 diff 기준으로는 해당 구절이 삭제된 상태이며 새 주석이 올바른 동작을 기술하고 있다.
- **제안**: 해소된 것으로 판단. 신규 주석("requires adding it here too")이 명확하게 수동 동기화 의무를 서술한다. 추가 수정 불필요.

---

### - **[WARNING]** `http-request.handler.ts` SSRF 가드 블록 — 내부 검토 태그 `(W-4)` 생산 코드 주석 잔존 여부

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/http-ssrf-all-auth/codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` line 341–343 (SSRF 가드 하단 한국어 주석)
- **상세**: 이전 리뷰 세션에서 `(W-4)` 내부 검토 태그가 production 코드 주석에 잔존한다고 WARNING 지적됐다. 현재 코드(line 341–343)를 직접 확인하면 `(W-4)` 참조가 제거됐다. 현재 주석은 "hostname literal 검사만으로는 공격자가 통제하는 DNS 가 공개 hostname 을 내부 IP 로 resolve 하는 DNS rebinding 시나리오에 무방어다." 로 교체되어 구체적 위협명을 영어로 표기하지 않고 한국어 풀어쓰기로만 기술한다. 외부 독자가 "DNS rebinding attack" 이라는 표준 용어로 검색·참조할 수 있도록 병기하면 가독성이 더 높아진다.
- **제안**: `(W-4)` 제거는 완료됐으나 위협 명칭을 "DNS rebinding attack" 과 같은 표준 용어와 병기하면 주석의 검색성이 개선된다. 예: `// DNS rebinding 시나리오(DNS rebinding attack)에 무방어다.` — 기능·보안에 영향 없음, LOW 개선 제안.

---

### - **[WARNING]** `backend-labels.ts` `HTTP_BLOCKED` 한국어 메시지 — 이전 누락 경고가 이번 변경에서 해소됐는지 확인

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/http-ssrf-all-auth/codebase/frontend/src/lib/i18n/backend-labels.ts` line 584–585
- **상세**: 이전 리뷰 세션(23_00_44) WARNING #7에서 `HTTP_BLOCKED` 한국어 매핑 누락이 지적됐다. 현재 파일을 직접 확인하면 이번 변경에서 `HTTP_BLOCKED` 키와 한국어 메시지가 이미 추가됐다("보안 정책(SSRF 방지)에 의해 해당 주소로의 요청이 차단됐어요. 내부망·loopback·클라우드 메타데이터 주소는 기본 차단되며, 자체 호스팅 환경에서 사설망 접근이 필요하면 관리자가 ALLOW_PRIVATE_HOST_TARGETS 를 설정해야 해요."). 이 메시지는 에러 원인 설명과 opt-out 환경변수 이름(`ALLOW_PRIVATE_HOST_TARGETS`)을 포함하여 운영자가 조치 방법을 파악할 수 있다. 단, 메시지가 다소 길고 기술적(환경변수 이름 포함)이어서 최종 사용자가 아닌 관리자를 주 독자로 가정하는데, 이는 이 에러가 self-host 관리자 레벨 조치를 요하는 경우에만 발생하므로 적절한 판단이다.
- **제안**: 이전 WARNING이 이번 변경에서 해소됐음. 추가 조치 불필요. 단, 메시지 길이(한국어 약 100자)가 UI 표시 영역에서 잘리지 않는지 실제 화면 렌더링 확인 권장.

---

### - **[INFO]** `error-codes.ts` `HTTP_BLOCKED` 주석 — 차단 범위 SoT 참조 없음

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/http-ssrf-all-auth/codebase/backend/src/nodes/core/error-codes.ts` line 14–16
- **상세**: `HTTP_BLOCKED` 주석("SSRF block (private/loopback/link-local/CGNAT target or redirect-hop / non-http(s) scheme). Applies to ALL auth methods (refactor 04 C-3).")은 차단 범위를 간략히 나열하지만 차단 판단 로직의 SoT(`http-safety.ts`)를 명시적으로 참조하지 않는다. 인접 코드(`EMAIL_HOST_BLOCKED`, line 30)는 "`ALLOW_PRIVATE_HOST_TARGETS=true` 로 opt-out" 안내를 포함하고 있으나, `HTTP_BLOCKED`는 해당 opt-out 안내가 없다. 두 에러 코드가 동일한 SSRF 가드를 통해 발생하므로 주석 수준의 일관성이 낮다.
- **제안**: `HTTP_BLOCKED` 주석에 "`ALLOW_PRIVATE_HOST_TARGETS=true` 로 opt-out. 상세: `http-safety.ts`" 를 추가하여 `EMAIL_HOST_BLOCKED` 주석 수준과 통일한다. 기능 영향 없음.

---

### - **[INFO]** `spec/conventions/node-output.md` D4 callout 링크 anchor 누락

- **위치**: `spec/conventions/node-output.md` D4 callout 블록 (diff 상 신규 추가 링크)
- **상세**: D4 callout이 `1-http-request.md`를 링크하지만 `#58-d4-...` anchor 없이 파일 최상단으로 이동한다. 이전 리뷰 세션(23_00_44)에서도 INFO로 지적됐다. anchor가 없으면 해당 §5.8 위치로 직접 점프하지 못해 문서 내비게이션 품질이 낮다.
- **제안**: 링크에 `#58-d4-handlervalidate-실패만-throw-나머지-모두-53으로-라우팅` anchor를 추가한다. anchor 슬러그는 GitHub/Markdown 렌더러의 헤딩 자동 변환 규칙에 따라 정확히 확인 후 적용.

---

### - **[INFO]** `spec/4-nodes/4-integration/1-http-request.md` §4 step 8 — dry-run SSRF 가드 생략 예외 미명문화

- **위치**: `spec/4-nodes/4-integration/1-http-request.md §4 step 8`
- **상세**: 코드(`http-request.handler.ts`)에서 dry-run 분기가 SSRF 가드보다 앞에 위치하여 dry-run 시 `assertSafeOutboundUrl`/`assertSafeOutboundHostResolved`가 호출되지 않는다. 코드 주석에 이 동작이 의도적임을 명시하고 있으나, spec §4 step 8은 이 예외를 서술하지 않는다. 이전 리뷰 세션(23_00_44)의 SPEC-DRIFT INFO #8이 동일 내용을 지적했다. 코드 동작은 합리적이고 spec 갱신이 정답이다.
- **제안**: `spec/4-nodes/4-integration/1-http-request.md §4 step 8`에 "(dry-run 실행 시 실제 fetch 없으므로 SSRF 가드 생략 — `spec/5-system/13-replay-rerun.md §7` 참조)" 한 줄 추가.

---

### - **[INFO]** `plan/in-progress/http-ssrf-all-auth.md` breaking change 내용 — PR 본문 반영 여부 미확인

- **위치**: `plan/in-progress/http-ssrf-all-auth.md` 하단 `⚠️ 운영 영향` 경고 블록
- **상세**: plan 문서에 `authentication=none`/`custom` + 사설망 호출 기존 워크플로가 `HTTP_BLOCKED`로 차단됨이 명시되어 있으며 `ALLOW_PRIVATE_HOST_TARGETS=true` 마이그레이션 경로도 기술되어 있다. 그러나 PR 본문 및 릴리스 노트에 이 breaking change 블록이 실제 기재됐는지는 이번 diff 범위에서 확인할 수 없다.
- **제안**: PR 머지 전 PR 본문에 breaking change 블록(migration 방법: `ALLOW_PRIVATE_HOST_TARGETS=true`)을 포함했는지 체크리스트에서 확인한다.

---

### - **[INFO]** `ALLOW_PRIVATE_HOST_TARGETS` 환경변수 적용 범위 확장 — 외부 운영 문서 미반영 가능성

- **위치**: 운영 가이드·배포 템플릿(docker-compose, Helm values 등) — diff 범위 외
- **상세**: `ALLOW_PRIVATE_HOST_TARGETS` 의 적용 범위가 `integration` 인증 전용에서 전 인증 방식 공통으로 확장됐다. spec 문서(§4 callout)는 갱신됐으나 외부 운영 문서(README의 환경변수 목록, 배포 가이드 등)에 이 변경이 반영됐는지는 본 diff 범위에서 확인 불가능하다.
- **제안**: PR 체크리스트에 "외부 운영 문서(`ALLOW_PRIVATE_HOST_TARGETS` 관련 섹션) 적용 범위 갱신" 항목 추가.

---

### - **[INFO]** `http-request.handler.ts` 인라인 주석 언어 혼용 — `(refactor 04 C-3)` 내부 식별자 잔존

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/http-ssrf-all-auth/codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` — SSRF 가드 블록 상단 영어 주석 `(refactor 04 C-3)`
- **상세**: `(W-4)` 태그는 제거됐으나 `(refactor 04 C-3)` 라는 내부 작업 식별자가 SSRF 가드 블록 영어 주석(line 339)과 `error-codes.ts` 주석(line 15) 등에 잔존한다. 동일 식별자가 `EMAIL_HOST_BLOCKED` 주석(line 30)에도 없으므로 일관성이 낮다. 외부 독자에게 이 식별자가 무엇을 가리키는지 불투명하다.
- **제안**: `(refactor 04 C-3)`를 제거하거나 `# plan: plan/in-progress/refactor/04-security.md C-3` 처럼 경로 참조로 교체하면 외부 독자도 추적 가능해진다. 기능 영향 없음.

---

## 요약

이번 변경의 문서화 상태는 전반적으로 양호하다. 이전 리뷰 세션(23_00_44)에서 WARNING으로 지적됐던 두 가지 핵심 이슈 — configEcho 블록 "자동 반영" 모순 주석과 `HTTP_BLOCKED` 한국어 매핑 누락 — 가 이번 변경에서 실제로 해소됐음이 코드 직접 확인으로 검증됐다. `(W-4)` 내부 검토 태그도 제거됐다. 남은 문서화 개선 포인트는 모두 INFO 수준으로, spec §4 step 8의 dry-run 예외 미명문화(SPEC-DRIFT), spec 링크 anchor 누락, `error-codes.ts` 주석 수준 불일치, 외부 운영 문서 갱신 여부 확인이다. PR 본문 breaking change 블록 기재 여부를 머지 전 체크리스트에서 확인하는 것이 가장 중요한 잔여 조치 사항이다.

---

## 위험도

LOW

STATUS: OK
