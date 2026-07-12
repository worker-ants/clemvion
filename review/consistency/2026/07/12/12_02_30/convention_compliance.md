# convention-compliance checker

> Disk-write 갭으로 원 output 유실 → journal.jsonl(wf_87e63bdd-d95) result 복구.
> 위험도: NONE, BLOCK 사유 없음.

### 발견사항

이번 세션의 실질 변경분(diff base `origin/main`)은 `spec/7-channel-web-chat/4-security.md` frontmatter `code:` 1줄 + 대응 코드 rename(`codebase/backend/src/modules/hooks/dto/responses/embed-config.dto.ts` → `embed-config-response.dto.ts`) + import 경로 1줄이 전부다. 이는 여러 과거 `/consistency-check` 세션(2026-06-17, 06-24, 06-27, 06-28, 07-09, 07-11, 07-12 01:41)에서 반복 지적돼 온 `spec/conventions/swagger.md §5-1`(`dto/responses/*-response.dto.ts` 파일명 패턴) 미준수 WARNING/INFO를 정정하는 후속 조치다. 검증 결과:

- **파일 rename 완결성**: `git mv`로 내용 변경 0(순수 rename) 확인. `codebase/backend/src/modules/hooks/dto/responses/`에는 이제 `embed-config-response.dto.ts` / `webhook-response.dto.ts` 두 파일만 있고 둘 다 `*-response.dto.ts` 패턴을 만족한다.
- **import 갱신**: `hooks.controller.ts:37`이 `./dto/responses/embed-config-response.dto`를 정확히 가리킨다.
- **spec frontmatter 미러**: `4-security.md` frontmatter `code:`가 신규 경로로 갱신됐다(`spec-impl-evidence.md §2.1` `code:` glob 실존 요건 충족).
- **잔존 참조 0건**: `grep -rn "embed-config\.dto"`(`-response` 없는 옛 형태) 결과 `spec/**`·`codebase/**` 실 소스에는 잔존 참조가 없다 — 남은 매치는 전부 `review/**`의 과거 스냅샷 기록뿐이며 이는 이력 아카이브이므로 정합성 문제가 아니다.
- **클래스명 `EmbedConfigDto` 유지**는 의도적이며 규약 위반이 아니다 — `swagger.md §5-1`은 **파일명**(위치+접미사)만 규정하고 클래스명은 규정하지 않으며, 같은 모듈의 `WebhookInteractionDto`/`WebhookAcceptedDto` 등 sibling과도 `*Dto` 관례로 일관된다(`plan/in-progress/embed-config-dto-rename.md`의 "컨벤션 재확인" 절이 이 스코프를 명시).
- **응답 wrapping**: `hooks.controller.ts`가 `@ApiOkWrappedResponse(EmbedConfigDto, …)` 공용 헬퍼를 그대로 사용하므로 `swagger.md §5-2` wrapping 규약도 무변경으로 유지된다.

target 위치: `spec/7-channel-web-chat/4-security.md` frontmatter `code:` (변경분), 위반 규약: 없음(오히려 `spec/conventions/swagger.md §5-1` 위반을 해소하는 정합화 커밋).

부가로 `spec/7-channel-web-chat` 전체 6개 문서(0-architecture / 1-widget-app / 2-sdk / 3-auth-session / 4-security / 5-admin-console + `_product-overview.md`)를 관련 정식 규약과 직접 대조 검토했으나 신규 CRITICAL/WARNING은 발견되지 않았다:
- 문서 구조(Overview/본문/Rationale 3섹션, `_product-overview.md`, `0-` prefix) — 6개 문서 모두 `## Overview`+`## Rationale` 보유, `_product-overview.md`는 타 영역(`2-navigation`, `5-system`) 선례와 동형 구조.
- frontmatter(`id`/`status`/`code:`) — `spec-impl-evidence.md §2` 스키마 준수, `id: web-chat-security` 등 영역-prefix 충돌회피 표기도 §2.1 선례(`nav-agent-memory`)와 동형 패턴.
- 출력 포맷(API 응답 envelope, SSE wire, 에러 코드) — `{ data }` 언랩 서술이 `swagger.md §2-5`·`api-convention §5.2`와 정확히 일치, `WEBCHAT_IDLE_TIMEOUT`은 `error-codes.md §1` 도메인 prefix(`<DOMAIN>_<CONDITION>`) 규약을 만족.
- `interaction-type-registry.md`/`conversation-thread.md` 매핑 — EIA 외부 3값 통합, `presentation_user`/`ai_user`→user 등 turn source 축약은 두 컨벤션이 명시적으로 인정한 위젯 scope carve-out(`conversation-thread.md §8.2`)과 정합.
- i18n — `codebase/channel-web-chat` 제외 스코프는 `i18n-userguide.md §적용 범위` carve-out과 정확히 일치, 반대로 `5-admin-console.md §8`은 in-scope로 올바르게 ko/en dict 갱신 의무를 명시.
- 금지 패턴 — `swagger.md §6` 레거시 빈 스키마, `conversation-thread.md §1.6` 신규 inline marker 금지, `chat-channel-adapter.md` 서버측 어댑터 패턴 답습 등 어느 것도 발견되지 않음(오히려 R2에서 명시적으로 회피 근거를 서술).

### 요약
이번 검토 대상 diff는 `spec/conventions/swagger.md §5-1` 응답 DTO 파일명 규약을 마지막으로 정합화하는 좁고 정확한 rename이며, rename 완결성(코드·import·spec frontmatter·잔존 참조 0건)을 모두 확인했다. `spec/7-channel-web-chat` 문서군 전체를 관련 규약(swagger.md, conversation-thread.md, interaction-type-registry.md, i18n-userguide.md, error-codes.md, spec-impl-evidence.md)과 교차 대조한 결과도 CRITICAL/WARNING급 신규 위반은 발견되지 않았으며, 오히려 각 영역이 관련 규약을 명시적으로 인용·carve-out 근거를 문서화하는 등 규약 준수 수준이 높다.

### 위험도
NONE
