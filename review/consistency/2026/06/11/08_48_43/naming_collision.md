# 신규 식별자 충돌 검토 결과

검토 범위: `V-16/V-17 + ai-review fix(topK @IsInt, Update DTO JSDoc, Swagger §3.4 제거, ws→워크스페이스)`. diff-base=origin/main. 모두 코드측 문서/검증 정정 — 신규 식별자를 도입하지 않는다.

---

## 발견사항

발견된 충돌 없음.

아래는 점검 6개 관점에 대한 검토 결과다.

### 1. 요구사항 ID 충돌
이번 diff 는 요구사항 ID 를 신규 부여하지 않는다. spec 변경 없음.

### 2. 엔티티/타입명 충돌

#### [INFO] `topK` — 동일 이름이 여러 컨텍스트에서 사용되나 의미 일관
- target 신규 식별자: `RagSearchDto.topK` 에 `@IsInt()` 추가 + description 에 "inject-cap 상한" 문구 추가
- 기존 사용처:
  - `/Volumes/project/private/clemvion/spec/5-system/9-rag-search.md` §3.4 및 footnote: `LIMIT topK(5)`, `top_k` (tool schema 파라미터)
  - `/Volumes/project/private/clemvion/spec/5-system/7-llm-client.md` L195/L199: `opts.topK` (RerankService 인터페이스)
  - `/Volumes/project/private/clemvion/spec/4-nodes/3-ai/1-ai-agent.md` L40: `ragTopK` (노드 config)
  - `/Volumes/project/private/clemvion/spec/data-flow/6-knowledge-base.md` L123: `topK?` (searchWithMeta 파라미터)
- 상세: `topK` 는 여러 레이어에서 같은 "주입 청크 상한" 의미로 일관되게 사용된다. spec §3.4 에서 "inject-cap" 개념과 동일 의미이며, description 갱신이 spec 과 정합한다. 충돌 없음.
- 제안: 이상 없음. `@IsInt()` 추가는 spec §3.4 "integer" 정의와 일치하는 타입 강화다.

#### [INFO] `profile` — webhook payload 파라미터명, 기존 spec 과 일치
- target 신규 식별자: `byo-ui-headless.ts` 의 `startHeadlessChat()` 시그니처에서 `firstMessage: string` 제거 → `profile?: Record<string, unknown>` 추가; `README.md` 예시 코드도 동일
- 기존 사용처:
  - `/Volumes/project/private/clemvion/spec/7-channel-web-chat/1-widget-app.md` L63, L69: `POST /api/hooks/:path { profile }` — spec 이 `firstMessage` 폐기·`profile` 사용을 명시
  - `/Volumes/project/private/clemvion/spec/7-channel-web-chat/2-sdk.md` L39, L107: `profile?: Record<string, unknown>` (SDK boot 파라미터)
  - `/Volumes/project/private/clemvion/spec/7-channel-web-chat/3-auth-session.md` L40: `POST /api/hooks/:path { profile }` (인증 흐름)
- 상세: `profile` 은 spec 전체에서 동일 의미(사용자 식별 정보 webhook payload)로 이미 확정 사용 중. `firstMessage` 제거도 spec `1-widget-app §R6` 결정과 일치. 충돌 없음.

### 3. API endpoint 충돌
이번 diff 는 새 API endpoint 를 추가하지 않는다. 해당 없음.

### 4. 이벤트/메시지명 충돌
이번 diff 는 webhook·SSE·queue 이벤트 이름을 추가하지 않는다. 해당 없음.

### 5. 환경변수·설정키 충돌
이번 diff 는 새 ENV var 또는 config key 를 추가하지 않는다. 해당 없음.

### 6. 파일 경로 충돌
이번 diff 는 새 파일을 생성하지 않는다. 기존 파일 수정만 포함한다. 해당 없음.

---

## 참고 — 잔존 일관성 문제 (충돌 아님, 본 검토 범위 외)

이번 diff 가 `update-knowledge-base.dto.ts` 의 `rerankLlmConfigId` description 을 `'ws default chat'` → `'워크스페이스 default chat'` 으로 수정하지만, `origin/main` 기준의 동일 파일에는 여전히 `'cross_encoder_llm grading LLMConfig (후속 구현). 미지정 시 ws default chat.'` 라인이 존재한다(`/Volumes/project/private/clemvion/codebase/backend/src/modules/knowledge-base/dto/update-knowledge-base.dto.ts` L176). diff 를 적용한 HEAD 에서는 해당 행이 이미 수정됐으므로 충돌이 아닌 정정 완료 상태다.

---

## 요약

이번 diff 는 기존 식별자(`topK`, `profile`, `rerankMode`, `rerankLlmConfigId` 등)에 대한 **문서 문자열·검증 데코레이터 정정**만 수행하며, 신규 식별자를 도입하지 않는다. 점검한 모든 관점(요구사항 ID, 엔티티/타입명, API endpoint, 이벤트명, 환경변수, 파일 경로)에서 기존 사용처와의 충돌이 발견되지 않았다. `topK` 의 `@IsInt()` 추가는 spec §3.4 의 integer 정의와 일치하고, `profile` 파라미터 도입은 spec `7-channel-web-chat/1-widget-app §R6` 의 `firstMessage` 폐기 결정과 정합한다.

## 위험도

NONE

STATUS: OK
