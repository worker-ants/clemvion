# 정식 규약 준수 검토 — request-body-guard (--impl-prep)

검토 대상: `plan/in-progress/request-body-guard.md` (요청 본문 스키마 가드 `request-body-advertised`
착수 전) 의 scope 로 묶인 `spec/5-system/15-chat-channel.md`(주 target) · `spec/conventions/swagger.md`
· `spec/5-system/2-api-convention.md` · `spec/5-system/12-webhook.md`.

번들이 컨텍스트 예산으로 절단된 2개 파일(`2-api-convention.md`·`12-webhook.md`)은 저장소
절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/request-body-guard/spec/...`)로
직접 Read 해 대조했다. `swagger.md` 최근 커밋(`f71f5df06`)의 diff, 그 직전 DTO 구현 커밋
(`a3a418ae3`)과 그 착수 전 리뷰(`review/consistency/2026/09/26/17_20_45`,`18_59_58`)도 함께
대조해 "이번에 새로 등재된 규칙"과 "이미 이전 라운드에서 처분된 항목"을 구분했다.

## 발견사항

이번 라운드에서 CRITICAL/WARNING 급 위반은 발견되지 않았다. 아래는 문서 품질 관점의 INFO 두 건이다.

- **[INFO]** `5-4. 새 엔드포인트 체크리스트` 제목과 실제 적용 범위(신규 vs 전 라우트 소급)의 괴리가 항목 하나 더 늘었다
  - target 위치: `spec/conventions/swagger.md` `### 5-4. 새 엔드포인트 체크리스트` 신규 불릿
    ("요청 본문을 받는 라우트(`@Body()`)는 본문 스키마를 광고한다 … 저장소 가드
    `request-body-advertised` 가 **모든 라우트**에서 …")
  - 위반 규약: 명시적 규약 위반은 아니다 — CLAUDE.md 의 "문서 구조 규약" 관점에서의 스캔성 이슈.
  - 상세: 같은 절 안에서 **세 번째**로 "새 엔드포인트 체크리스트"라는 제목과 달리 **기존 배포
    라우트까지 소급**하는 항목이 추가됐다(선행 두 건은 §2-4 성공 코드 짝, 403 설명의 거부
    코드 — 각각 Rationale 에 "기존 라우트까지 소급한다"고 명시돼 있다). 이번 요청 본문 항목도
    본문에는 "**모든 라우트**에서 … 잡는다"고 명시해 각 항목 단위로는 정확하지만, 절 제목
    자체("새 엔드포인트")는 세 항목째 배반되고 있어 제목만 훑는 독자에게는 "새로 만들 때만
    지키면 된다"는 오독 여지가 계속 누적된다.
  - 제안: 이번 PR 범위 밖(문구 변경 없이도 가드 구현은 가능)이나, 후속 편집 시 절 제목을
    "5-4. 엔드포인트 체크리스트 (일부 항목은 기존 라우트에도 소급)"처럼 조정하거나, 절 도입부에
    "이 중 소급 적용 항목은 각 항목에 명시" 한 줄을 추가하는 편이 반복되는 오독을 막는다.

- **[INFO]** `@ApiBody({ schema: {} })` 와 §6 "빈 껍데기 스키마 금지"의 시각적 유사성이
  명시적으로 갈라지지 않음
  - target 위치: `spec/conventions/swagger.md` 신규 Rationale
    `### §5-4 요청 본문 스키마 — 왜 클래스로 받게 강제하지 않고, 왜 reflection 으로 세는가` 의
    "`schema: {}` 와 열린 map 은 다르다" 단락
  - 위반 규약: `spec/conventions/swagger.md` `## 6) 레거시 패턴 제거` — "`@ApiOkResponse({ schema:
    { type: 'object', properties: { data: { type: 'object' } } } })` 같은 '빈 껍데기'는 반드시
    DTO 기반 래퍼로 교체하세요."
  - 상세: 새 단락은 §1-4(닫힌 union 을 `additionalProperties` 로 뭉개지 않는다)와의 구분만
    교차 참조하고, 표기가 더 닮은 §6 의 "빈 껍데기 스키마" 금지와는 교차 참조하지 않는다.
    §6 은 **응답**(`ApiOkResponse`) 의 게으른 빈 객체를 금지하는 규칙이고 새 규칙은 **요청**
    (`ApiBody`) 에서 "형태가 실제로 정해지지 않음"을 뜻하는 의도된 표기라 실질적으로 충돌하지는
    않지만, `schema: {}` 라는 리터럴이 두 문맥에서 반대 의미(전자는 금지 대상, 후자는 권장
    표기)로 쓰이므로 §6 을 먼저 읽은 독자가 새 규칙을 §6 위반으로 오인할 여지가 있다.
  - 제안: 새 단락 끝에 "§6 의 응답 '빈 껍데기' 금지와는 무관 — 그쪽은 실제 형태를 알면서
    안 적는 게으름을, 여기는 형태 자체가 발신자 재량인 경우를 가리킨다" 정도의 한 줄을
    덧붙이면 충분하다.

## 확인 항목 (위반 없음 — 근거 기록)

- **명명 규약**: `request-body-advertised` 는 형제 가드 `http-status-advertised` 와 동형 접미
  패턴이고, `frontmatter code:` 글롭(`request-body-advertised*.ts`)도 `forbidden-response-codes*.ts`
  ·`http-status-advertised*.ts` 와 동일한 "가드+스펙 한 쌍" 글롭 스타일을 따른다. 실제 저장소에도
  `<name>-guard.ts` + `<name>.spec.ts` 페어 관례가 이미 3쌍 존재해(`forbidden-response-codes-guard.ts`
  ·`http-status-advertised-guard.ts`·`param-uuid-pipe-guard.ts`) 새 이름이 그 관례에서 벗어나지 않는다.
- **API 문서 규약**: 신규 불릿의 `@ApiBody({ type })` / `@ApiBody({ schema: {} })` / `@ApiExcludeEndpoint()`
  ·`@ApiExcludeController()` 제외 목록은 실제 저장소의 `forbidden-response-codes-guard.ts` 가 이미
  두 데코레이터를 함께 배제하는 것과 일치한다(`isExcluded()` 함수, "핸들러 `@ApiExcludeEndpoint()` 또는
  클래스 `@ApiExcludeController()`"). `http-status-advertised-guard.ts`·`param-uuid-pipe-guard.ts`
  는 `@ApiExcludeEndpoint()` 만 배제하는 기존 비대칭이 있으나, 이는 이번 PR 이 만든 신규 불일치가
  아니라 **선행 코드베이스 상태**이고, 새 규칙은 더 넓은 배제 쪽(선례 중 하나)을 그대로 계승한다.
- **문서 구조 규약**: 새 불릿은 기존 `### 5-4. 새 엔드포인트 체크리스트` 안에, 새 Rationale
  절은 문서 하단 `## Rationale` 안에 정확히 배치됐고, 제목 패턴(`### §5-4 <주제> — 왜 …가 (날짜)`)도
  바로 위 형제 절(`§5-4 403 설명의 거부 코드`)과 동일 포맷이다.
- **크로스 레퍼런스 정확성**: Rationale 이 인용하는 `rotate-bot-token` 의 `INVALID_BOT_TOKEN`
  (`15-chat-channel.md §5.4`) 은 실제로 그 절(`#### 5.4 Bot Token Rotation API 응답 계약`,
  `#### 5.4.1` 이전) 표 안에 존재함을 라인 단위로 확인했다. 선례로 든 `ExecuteWorkflowDto`
  (`workflows/dto/execute-workflow.dto.ts`) 도 실제로 class-validator 데코레이터 없이
  `@ApiPropertyOptional` 만 쓰는 "문서 전용 DTO" 형태임을 확인했다.
- **이중 등재 원칙**: `2-api-convention.md §5.4 검증 층` 표는 "§5.4 와 swagger §5-1 양쪽이
  공유하는 검증자만 두 문서 `code:` 모두에 등재한다"는 원칙을 명시하는데, `request-body-advertised`
  는 api-convention.md 가 주장하는 규칙(응답 null/키생략)을 강제하지 않으므로 그 문서의 `code:`
  에 등재할 필요가 없다 — 실제로 등재돼 있지 않다. `http-status-advertised`·`forbidden-response-codes`
  ·`param-uuid-pipe` 도 같은 이유로 api-convention.md 밖에 있어, 새 가드가 이 선례를 깨지 않는다.
- **선행 라운드 처분 확인**: 같은 트래커의 앞선 서브플랜(`rotate-bot-token-body`)에 대한 이전
  convention_compliance 리뷰(`review/consistency/2026/09/26/17_20_45`)가 지적한 두 WARNING
  (`writeOnly` 누락 위험, `ExecuteWorkflowDto` 선례의 class JSDoc 내부 서사 복제 위험)은 실제
  구현(`chat-channel-rotate-bot-token-request.dto.ts`)에서 `@ApiProperty({ writeOnly: true })`
  와 `//` 주석 분리로 반영돼 있음을 확인했다 — 재발 없음.

## 요약

이번 --impl-prep scope(요청 본문 스키마 가드 `request-body-advertised` 착수)의 target 문서는
정식 규약을 위반하지 않는다. `swagger.md` §5-4 신규 불릿·Rationale 은 명명·글롭 패턴·데코레이터
배제 범위·문서 구조(체크리스트 안 + Rationale 절)·크로스 레퍼런스 정확성 모두 기존 형제 규칙
(§2-4 성공 코드, §5-4 403 설명)과 정합하고, 이중 SoT 등재 원칙도 지킨다. 앞선 서브플랜에서
지적된 WARNING 들도 구현 단계에서 이미 처분됐음을 코드로 확인했다. 남은 두 INFO 는 규약 위반이
아니라 "체크리스트 제목과 소급 범위의 누적된 괴리", "`schema: {}` 표기의 §6 과의 시각적 유사성"
이라는 스캔성 개선 제안이며, 가드 구현 착수를 막을 사유가 아니다.

## 위험도

NONE
