# 신규 식별자 충돌 검토 — spec/conventions/ (impl-done)

## 검토 범위 확인

prompt 번들의 대부분(275개 bundle-file 중 271개)이 컨텍스트 예산으로 절단되어 있어, 실제
델타는 워킹트리를 절대경로로 직접 대조해 확인했다 (`git -C ".../plan-in-progress-items-b0c80b" diff origin/main...HEAD`).

- `spec/conventions/migrations.md` — 7 lines changed (2 clarifying edit)
- `spec/conventions/review-citations.md` — **신규 파일**, 136 lines (전량 추가)
- `spec/conventions/spec-impl-evidence.md` — 2 lines changed (`code:` 필드 정의에 예외 각주 추가)
- (참고, scope 밖) `codebase/backend/migrations/README.md` +39/-3, `spec/data-flow/8-notifications.md` +6

이 중 "새 식별자를 도입"하는 실질적 변경은 `review-citations.md` 신규 등재 1건이 거의
전부다. 아래는 6개 관점 전수 점검 결과.

## 발견사항

이번 델타에서 CRITICAL/WARNING 급 신규 식별자 충돌은 발견되지 않았다. 점검한 6개 관점 각각의
근거는 다음과 같다.

- **요구사항 ID 충돌 (frontmatter `id:`)** — 신규 `id: review-citations` 가
  `spec/conventions/*.md` 전체 frontmatter (`audit-actions`, `cafe24-api-metadata`,
  `chat-channel-adapter`, `migrations`, `spec-impl-evidence`, `swagger` 등 22개)와
  전수 대조해 **유일**함을 실측 확인 (`grep -rn "^id: " spec/conventions/*.md`). 충돌 없음.

- **엔티티/타입명 충돌** — 이번 델타는 새 DTO/인터페이스를 정의하지 않는다 (순수 문서형
  convention). `chat-channel-adapter.md` 는 번들에 전문 포함됐지만 diff 밖(unchanged) 이라
  분석 대상 아님.

- **API endpoint 충돌** — 해당 없음. 신규/변경 endpoint 없음.

- **이벤트/메시지명 충돌** — 해당 없음.

- **환경변수·설정키 충돌** — 해당 없음.

- **파일 경로 충돌** — 신규 파일 `spec/conventions/review-citations.md` 는 (a) 기존
  `spec/conventions/` 안의 어떤 파일과도 이름이 겹치지 않고, (b) 그 폴더의 flat/무-prefix
  명명 관행(`audit-actions.md`, `conversation-thread.md`, `egress-masking.md` 등, 숫자
  prefix 없음)과 정합하며, (c) `spec/conventions/` 는 `spec-area-index.test.ts` 에서
  "flat reference, 무-index" 로 명시 면제된 폴더라 색인 갱신 누락도 아니다. 충돌 없음.

  또한 `code:` frontmatter 가 새로 가리키는 두 파일
  (`codebase/backend/src/common/guards/roles.guard.spec.ts`,
  `codebase/frontend/src/components/llm-config/sanitize-loader-error.ts`) 을 절대경로로
  확인한 결과 실존하며, 다른 어떤 convention 의 `code:` 도 같은 두 파일을 (다른 의미로)
  가리키고 있지 않다 (`grep -rln` 전수 대조) — "같은 예시 파일이 서로 다른 규약의 준수
  증거로 이중 등재"되는 충돌은 없다.

### INFO — "bare" 용어의 문서 간 동음이의 (매우 경미, 혼동 우려 낮음)

- **target 신규 사용**: `review-citations.md` §2 의 "bare `hh_mm_ss`" (날짜 없는 세션 시각
  인용 형태를 가리킴)
- **기존 사용처**: `spec/conventions/cafe24-api-metadata.md:378-439`, `makeshop-api-metadata.md:106`
  (prefix 제거된 MCP tool id), `spec/conventions/frontend-layering.md:49,85` (서브패스 없는
  import 형태)
- **상세**: 동일 영단어 "bare" 가 세 개 이상의 무관한 도메인(리뷰 인용 시각 형식 / MCP
  operation id / import 경로 형태)에서 형용사로 쓰인다. 다만 이는 정의된 식별자(ID·타입명·키)의
  충돌이 아니라 일반 영단어의 반복 사용이며, 각 문서 내 문맥이 명확해 실제 혼동 사례나 교차
  참조는 없다.
- **제안**: 조치 불요. 별도 용어집이 생기면 참고 정도로만 남겨둔다.

## 요약

이번 라운드의 실질 신규 식별자 도입은 `spec/conventions/review-citations.md` 파일 신설
(`id: review-citations`) 이 유일하며, ID·파일 경로 모두 기존 `spec/conventions/` 22개
문서와 전수 대조해 충돌이 없음을 확인했다. `migrations.md`/`spec-impl-evidence.md` 의
변경은 기존 식별자(§ 번호 참조, `code:` 필드 정의)에 대한 정정·각주 추가일 뿐 새 식별자를
만들지 않는다. API endpoint·이벤트명·환경변수·엔티티 타입 등 나머지 관점은 이번 델타에
해당 사항이 없다. "bare" 라는 일반 단어의 문서 간 반복 사용은 정의된 식별자 충돌이 아니라
INFO 로만 기록한다.

## 위험도

NONE
