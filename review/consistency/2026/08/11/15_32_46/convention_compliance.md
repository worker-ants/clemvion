# 정식 규약 준수 검토 — `spec/7-channel-web-chat/4-security.md`

검토 대상 diff: §1 표 `apiBase 입력 검증` 행 갱신 + `## Rationale` 에 `### R0. apiBase 스킴 검증을 두 경로 모두에 거는 이유` 신설.

## 발견사항

- **[WARNING]** `Rationale` 항목 번호 `R0` — 저장소 전역 관례(단조 증가 + 끝에 이어붙임)에서 유일하게 이탈
  - target 위치: `spec/7-channel-web-chat/4-security.md` `## Rationale` 절, 기존 `R1~R6` **바로 앞**에 삽입된 `### R0. \`apiBase\` 스킴 검증을 **두 경로 모두**에 거는 이유 (2026-08-11)`
  - 위반 규약: 단일 `spec/conventions/*.md` 문서가 "모든 spec 의 Rationale 은 R1 부터 시작해 다음 번호를 이어 붙인다"를 명문화한 조항은 없다(즉 이 지적을 CRITICAL 로 올릴 근거는 없음). 다만 다음 두 곳이 **같은 정신**을 명시적으로 선언한다:
    - `spec/conventions/chat-channel-adapter.md` §Rationale ID 컨벤션: "본 컨벤션 파일의 신규 Rationale 은 `R-CCA-N` prefix... 기존 `R1~R4` 는 하위 호환 유지"
    - `spec/5-system/15-chat-channel.md` §Rationale ID 컨벤션: "본 절 신규 항목은 `R-CC-N` prefix... 기존 `R1~R9`/`R-K` 는 하위 호환 위해 그대로 유지" (이어서 `R-CC-10`, `R-CC-11`... 로 계속 이어붙임)
    그리고 실제 관측: 저장소 내 Rationale 을 가진 **모든** spec 파일(`0-architecture.md`, `5-admin-console.md`, `4-security.md` 자신의 기존 R1~R6, `5-system/14-external-interaction-api.md` R1~R19, `5-system/15-chat-channel.md`, `4-nodes/7-trigger/providers/telegram.md`, `conventions/secret-store.md`, `conventions/chat-channel-adapter.md`)가 예외 없이 `R1` 부터 시작해 단조 증가하며, 신규 결정은 **끝에** 다음 번호로 추가된다(`R18`→`R19` 식). `git log -S "### R0."` 로 저장소 전체 이력을 조회하면 **이 커밋이 유일한 `R0` 사용례**다.
  - 상세: 이번 PR 은 새 결정을 기존 R1~R6 뒤(자연스러운 다음 번호는 `R7`)가 아니라 앞(`R0`)에 얹었다. 기존 R1~R6 헤딩 텍스트·앵커는 그대로라 `[R6](...)` 같은 cross-file 참조(`5-system/12-webhook.md`, `5-system/1-auth.md`, `data-flow/10-triggers.md` 등 4곳에서 `#r6-...` 앵커 인용)는 깨지지 않는다 — 이 점은 확인했다. 문제는 앵커 파손이 아니라, "새 결정은 끝 번호를 잇는다"는 전-저장소 100% 일관 관례에서 이번 건만 이탈했다는 점이다. CLAUDE.md 의 `0-` prefix 관례(`spec/0-overview.md` 등 **파일명 레벨** cross-cutting 진입 문서 표시)와 이번 `R0` 의 "0" 이 의미상 무관한데, 표기가 같아 향후 독자가 "R0 = 이 문서의 기초/선행 전제"로 오인하거나, 반대로 CLAUDE.md 의 `0-` 파일명 관례를 문서 **내부** 번호 체계로 잘못 유추한 결과일 가능성도 있다.
  - 제안: (a) 저장소 전역 관례를 따르는 것이 목적이면 `R0` → `R7` 로 재번호(다른 R1~R6 는 안 건드려도 되므로 외부 앵커 파손 없음, 본 파일 내부에도 `§R0`/`#r0-` 자기참조가 없어 안전하게 이동 가능 — 확인함). (b) "이 결정이 다른 모든 결정보다 선행하는 전제"라는 의도로 0 을 택한 것이라면, 그 자체는 저장소에 전례가 없는 새 패턴이므로 CLAUDE.md 또는 전용 `spec/conventions/*.md` 에 "0 은 선행/공리적 결정에 예약한다" 같은 규약을 명문화해 다른 문서 작성자도 일관되게 따를 수 있게 해야 한다(현재는 이 파일 하나에만 존재하는 암묵적 예외).

- **[INFO]** frontmatter `code:` 목록에 `use-widget.ts` 미등재 (기존 상태, 이번 diff 로 새로 생긴 문제 아님)
  - target 위치: §1 표 `apiBase 입력 검증` 행 — "코드 SoT: `use-widget.ts` 의 `safeApiBase`/`configFromQuery`/`mergeBootConfig`"
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2 (frontmatter `code:` 스키마) / §4 `spec-code-paths.test.ts`
  - 상세: 문서 frontmatter `code:` 는 `codebase/channel-web-chat/src/widget/host-bridge.ts`, `codebase/channel-web-chat/src/lib/safe-html.ts` 등은 등재했지만 `codebase/channel-web-chat/src/widget/use-widget.ts` 자체(또는 이를 포괄하는 glob)는 없다. `spec-code-paths.test.ts` 가드는 "`code:` 글로브가 ≥1 파일에 매치"만 검사하므로(다른 항목이 매치해 통과) build 는 깨지지 않지만, 본문이 실제 SoT 로 지목하는 파일이 frontmatter 증거 목록에서 빠져 있어 `spec-impl-evidence.md` 의 취지(spec 서술 ↔ frontmatter 증거 정합)와는 완전히 맞지 않는다. 단 이 파일 참조는 이번 PR 이전부터 존재했다(diff 전 문구도 이미 "코드 SoT: `use-widget.ts configFromQuery`/`safeApiBaseFromQuery`"였음) — 이번 변경은 문구·함수명만 갱신했을 뿐 새로 만든 문제가 아니다.
  - 제안: 이번 PR 스코프 밖 — 후속으로 frontmatter `code:` 에 `codebase/channel-web-chat/src/widget/use-widget.ts` (또는 `codebase/channel-web-chat/src/widget/**`) 추가를 고려. 차단 사유 아님.

- 코드 SoT 사실관계 검증(참고, 이슈 아님): R0 본문이 인용하는 `resolveIframeTarget`(`codebase/packages/web-chat-sdk/src/bridge.ts`), `configFromQuery`/`safeApiBase`/`mergeBootConfig`(`codebase/channel-web-chat/src/widget/use-widget.ts`), `applyConfig` 의 `if (!cfg.apiBase || !cfg.triggerEndpointPath) return;` (warn/dispatch 없이 조용히 반환, 형제 분기인 origin allowlist 실패는 `BLOCKED` dispatch) 는 모두 실측 확인됨 — 지어낸 근거 없음. `feedback_rationale_rejected_alternatives_need_history` 관례("기각된 대안"은 실제 이력 필수)에 부합.

## 요약

이번 diff 는 `spec/conventions/**` 가 강제하는 **build-차단 invariant**(frontmatter `code:` 매치, 링크·앵커 무결성, `status`/`pending_plans` 라이프사이클 등)를 어느 것도 깨지 않는다 — R1~R6 앵커는 텍스트 불변으로 안전하고, cross-file 참조 4곳도 그대로 유효하며, `code:` 글로브 매치 요건도 다른 항목들이 충족한다. 다만 `### R0.` 라는 번호 선택은 이 저장소의 **모든** Rationale 보유 spec 파일이 예외 없이 지켜온 "R1 부터 시작해 다음 번호를 끝에 이어 붙인다"는 100% 일관 관례(두 파일이 명문화한 "Rationale ID 컨벤션"과 같은 정신)에서 유일하게 벗어난 사례이며, 공식 문서화 없이 새 패턴을 도입한 것이라 WARNING 으로 등재한다. `기각한 대안` 서술 형식과 근거 실측(코드 identifier·분기 동작)은 저장소 관례에 정확히 부합하며 사실관계도 검증됐다 — 이 부분은 모범적이다. `code:` frontmatter 관련 지적은 이번 PR 이전부터 있던 상태라 INFO 로만 등재한다.

## 위험도

LOW

STATUS: OK
