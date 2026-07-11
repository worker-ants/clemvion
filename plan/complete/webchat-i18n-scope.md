---
worktree: happy-tesla-906461
started: 2026-07-12
owner: project-planner
spec_impact:
  - spec/conventions/i18n-userguide.md
  - spec/7-channel-web-chat/_product-overview.md
  - spec/7-channel-web-chat/2-sdk.md
  - spec/7-channel-web-chat/5-admin-console.md
---

# channel-web-chat i18n 스코프 명문화 + SDK locale reserved/inert 정직화 (완료)

> 유형: 문서/규약 정합 (코드 변경 없음)
> 트리거: consistency-check(--spec·--impl-done) 가 웹채팅 위젯의 하드코딩 한국어(예: "총 N개 중 일부만 표시돼요.",
> "일부 행만 표시됩니다.", "대화를 종료할까요?" 등)가 i18n-userguide Principle 1(dict 키 경유) 스코프 대상인지에 대해
> 규약이 침묵 → 반복 WARNING. 추가로 SDK `BootConfig.locale` 이 실제 위젯 UI 언어에 관여하지 않는(dead/passthrough)
> cross_spec 갭.

## 옵션 라벨 정의 (추적성)

- **(a)** = `i18n-userguide.md` 에 적용 범위 절 신설(위젯 dict-indirection carve-out).
- **(b)** = `7-channel-web-chat/_product-overview.md §2 비목표` 에 위젯 EN 다국어화 + locale reserved 명문화.
- **(c)** = 위젯에 dict indirection 도입(EN 지원 착수) — **기각**(코드 변경, 본 태스크 "코드 변경 없음" 원칙 위배).

## 배경 (실측 확정)

1. **`BootConfig.locale` = 수용-but-inert(dead passthrough)**: 위젯(`codebase/channel-web-chat`)은 `locale` 을 타입 선언·
   query(`configFromQuery`)·`wc:boot`·`config` state 로 실어 나르지만 **어디서도 읽지 않는다**. UI 언어 선택 없음,
   `Accept-Language`/locale query param 없음, `Intl`/`toLocale*` 없음. `locale=ko`/`en` 무관하게 한국어 무조건 렌더.
   단 **운영자 대면**(운영 콘솔 §4 폼 필드·설치 스니펫·iframe `src` `&locale=`, §6.1 remount). 삭제 = 공개 SDK 계약 +
   운영자 폼 회귀(code). → reserved 로 남기고 정직화.
2. **위젯 = dict indirection 없는 별도 표면**: dict/`t()`/message catalog·i18n 의존성 전무, 인라인 한국어(해요체),
   EN 미지원 = Korean-only.
3. **가드가 이미 위젯 스캔 밖**(규약이 현실 문서화만 하면 됨): `hardcoded-korean-ratchet`(스캔 루트
   `codebase/frontend/src/{components,app,lib}`)·`doc-sync-matrix`(`new-ui-string` glob `codebase/frontend/src/**/*.tsx`)
   둘 다 `channel-web-chat` 미스캔.
4. **구성요소 D(운영 콘솔)는 frontend 라 in-scope**: 콘솔 메뉴 문자열(`sidebar.webChat` 등)은
   `codebase/frontend/src/app/(main)/w/[slug]/web-chat/**` 로 이미 Principle 1·2 대상(5-admin-console §8). 제외되는 건
   위젯 SPA(`codebase/channel-web-chat`) 뿐.

## 사용자 결정 (2026-07-12)

- **문서 범위**: (a)+(b) 둘 다.
- **locale 성격**: reserved / accepted-but-inert (삭제·no-promise 아님). Korean-only 는 v1 스코프 경계로 프레이밍,
  영구 결정으로 박제 안 함.

## 적용한 변경 (4개 파일)

- **[x] Edit A — `spec/conventions/i18n-userguide.md`**: `## 적용 범위 (Scope)` 신설(frontend/backend/packages 적용,
  channel-web-chat 위젯 SPA 는 P1·2 제외, P6 문체는 적용, 운영 콘솔은 in-scope 경계 명시) + intro 포인터 +
  Rationale `### 왜 channel-web-chat 위젯은 dict-indirection 스코프 밖인가`(conversation-thread §9 선례 계승 인용).
- **[x] Edit B — `spec/7-channel-web-chat/_product-overview.md §2 비목표`**: 위젯 UI 다국어화(EN) v1 비목표 + locale
  reserved 명문화.
- **[x] Edit C — `spec/7-channel-web-chat/2-sdk.md §4`**: 스키마 `locale` 필드 reserved/inert 주석 + 산문 note +
  Rationale `### R6. locale 은 reserved`. **WARNING 해소**: 108행 bare `§R6` → `[1-widget-app §R6](./1-widget-app.md)`
  파일-한정 링크화(101-102행 패턴).
- **[x] Edit D — `spec/7-channel-web-chat/5-admin-console.md`**: §4 폼 필드 reserved 각주 + §6.1:214 cross-ref 각주.

## consistency-check 결과 (`--spec`, review/consistency/2026/07/12/00_05_29)

- **BLOCK: NO** (Critical 0).
- **WARNING 1** (convention_compliance + naming_collision 독립 수렴): 신규 `### R6` 가 기존 bare `§R6`(→ 1-widget-app
  eager-start)와 오귀속 위험 → **해소**(Edit C 108행 파일-한정 링크화, 신규 heading 은 R2→R6 순번 유지).
- **rationale_continuity**: disk-write gap 으로 유실됐던 결과를 journal.jsonl 에서 복구 → 실제 판정 **NONE**. "글로벌 규약
  + 위젯 carve-out + 명시 Rationale" 이 `conversation-thread.md §9` 선례와 구조 일치(강한 정합 신호).
- **INFO 반영**: packages scope 1줄 추가, backend-labels 소재(frontend) 명시, Edit B anchor `#적용-범위-scope` 지정,
  §6.1 cross-ref 각주. (자동 가드 요약 표 행 추가는 표가 Principle 전용이라 미반영 — 선택 사항.)

## 검증

- `spec-link-integrity.test.ts` **13/13 pass** — 신규 anchor(`#적용-범위-scope`·`#2-목표--비목표`·`#4-boot-config-스키마`)·
  링크 전부 resolve.
- Gate C: `spec_impact` 4파일 리스트 선언(전부 실존, `started` 2026-07-12 → Gate C 대상).

## Rationale (결정 근거)

- **(c) 기각**: EN 착수 = 코드 변경, 본 태스크 "코드 변경 없음" 명시. Korean-only 상태에서 dict-indirection 은 이득 0 → v1 defer.
- **삭제 대신 reserved 정직화**: locale 은 운영자 대면(콘솔 폼·스니펫·iframe src)이라 삭제 = 공개 계약 + 폼 회귀. "박제"
  리스크(Korean-only 영구화) 회피 위해 v1 스코프 경계 + forward-compat reserved 로 프레이밍.
- **P6 문체는 위젯에 유지**: 위젯이 이미 해요체 사용(슬립 1건: 잘림배너 "…표시됩니다."), 제품 보이스 일관성상
  dict-indirection 만 면제하고 글로서리·문체는 공유. 문체 슬립 교정은 별도 code 변경(본 spec 태스크 범위 밖 — 별건).
