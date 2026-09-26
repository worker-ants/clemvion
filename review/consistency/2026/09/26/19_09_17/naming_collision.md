# 신규 식별자 충돌 검토 — request-body-guard (--impl-prep)

## 점검 대상 신규 식별자

target 번들(`spec/conventions/swagger.md` §5-4 확장 + `plan/in-progress/request-body-guard.md` +
`plan/in-progress/spec-draft-swagger-request-body.md`, 이미 `--spec` 통과·커밋됨)이 이번에 새로
도입하는 식별자를 아래로 좁혔다 (chat-channel.md·2-api-convention.md·12-webhook.md 는 impl-prep
scope 번들에 딸려온 **문맥 참조 문서**일 뿐 이번 target 이 새 식별자를 얹는 자리가 아니므로
비교 기준으로만 사용):

1. 저장소 가드 이름 `request-body-advertised` (+ 파생 파일 `request-body-advertised-guard.ts` /
   `request-body-advertised.spec.ts`, frontmatter glob `request-body-advertised*.ts`)
2. `swagger.md` §5-4 체크리스트에 추가되는 불릿 1줄 (새 heading 아님 — 기존 §5-4 확장)
3. `swagger.md` Rationale 새 절 제목 `§5-4 요청 본문 스키마 — 왜 클래스로 받게 강제하지 않고, 왜
   reflection 으로 세는가 (2026-09-26)`

## 발견사항

없음.

- **가드 이름/파일 충돌 — grep 0건**: `codebase/backend/src/repo-guards/__tests__/` 를 전수
  ls 했으나 `request-body-advertised*` 로 시작하는 파일이 없다(가드 미착수 상태와 일치). 저장소
  전체(`codebase/`, `spec/`, 루트/백엔드 `CHANGELOG.md`) grep 도 0건 — 다른 의미로 이미 쓰이는
  자리가 없다.
- **명명 패턴 정합**: 형제 가드 `http-status-advertised-guard.ts` / `.spec.ts` 와 동일한
  `<주제>-advertised{-guard,.spec}.ts` 패턴을 그대로 따른다 — 충돌이 아니라 기존 컨벤션과의
  일관성이 확인됨.
- **§5-4 heading 충돌 없음**: `swagger.md` 안에 `### 5-4` heading 은 하나뿐이고(502행), 이번
  변경은 그 아래 체크리스트에 불릿 한 줄을 추가할 뿐 새 heading/anchor 를 만들지 않는다.
- **Rationale 절 제목 충돌 없음**: 신설 제목 문자열로 `swagger.md` 전체를 grep 했을 때 중복 없음
  (형제 절 `§5-4 403 설명의 거부 코드 — …` 와 제목이 명확히 구분됨).
- **함수/타입 재사용은 신규 식별자가 아님**: 가드 구현 계획이 `forbidden-response-codes-guard.ts`
  의 `collectRouteHandlers` 를 그대로 import 재사용하겠다고 적었다 — 새 이름을 선언하는 것이
  아니라 기존 export 를 그대로 쓰는 것이라 충돌 대상이 아니다. 그 파일의 다른 export
  (`guardRejectionCodes` · `scanForbiddenResponseCodes`) 와도 이름이 겹치지 않는다.
- **DTO 명명 선례와 정합**: Rationale 이 언급하는 `ExecuteWorkflowDto` · `ContinueExecutionRequestDto`
  는 이미 존재하는 이름이고(직전 완료된 `rotate-bot-token-body` 작업 산출물), `*RequestDto` 접미
  패턴은 기존 `ReRunRequestDto` 와도 일치 — 새 이름 충돌 없음.
- **plan 파일명 충돌 없음**: `plan/in-progress/request-body-guard.md` · `spec-draft-swagger-request-body.md`
  는 `plan/in-progress/` · `plan/complete/` 어디에도 동명 파일이 없다.
- **API endpoint / 이벤트명 / ENV 변수**: 이번 target 은 신규 endpoint, webhook/queue/SSE 이벤트,
  ENV 변수를 도입하지 않는다(§5-4 체크리스트 규칙 + reflection 가드만 추가) — 해당 관점은
  적용 대상 없음.

## 요약

이번 target(`request-body-advertised` 가드 신설 + `swagger.md` §5-4 규칙 한 줄 + Rationale 한
절)이 도입하는 식별자는 가드 이름 하나와 그 파생 파일명, 문서 heading 텍스트 하나뿐이며, 저장소
전수 grep 으로 기존 사용처가 전무함을 확인했다. 명명 패턴도 형제 가드(`http-status-advertised`)
와 동일 계열을 따르고, 재사용을 명시한 함수·DTO 이름은 모두 기존 정의와 정합한다. 신규 식별자
충돌 관점에서 차단 사유 없음.

## 위험도

NONE
