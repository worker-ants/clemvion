# API 계약(API Contract) 리뷰 결과

> 대상: webchat eager start §R6 (패널 open 시 execution 시작, firstMessage 폐기)
> 생성일: 2026-06-06
> 세션: `review/code/2026/06/06/12_58_00`

---

## 해당 없음 — 위험도 NONE

변경된 파일 목록:

- `codebase/channel-web-chat/src/lib/eia-client.ts` — 클라이언트 측 payload 타입 수정 (firstMessage 제거)
- `codebase/channel-web-chat/src/lib/eia-client.test.ts` — 테스트 갱신
- `codebase/channel-web-chat/src/lib/widget-state.ts` — 위젯 내부 상태기계 변경
- `codebase/channel-web-chat/src/lib/widget-state.test.ts` — 테스트 갱신
- `codebase/channel-web-chat/src/widget/components/panel.tsx` — UI 컴포넌트 변경
- `codebase/channel-web-chat/src/widget/components/panel.test.tsx` — 테스트 신규
- `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` — 테스트 신규
- `codebase/channel-web-chat/src/widget/use-widget.ts` — 위젯 훅 로직 변경
- `plan/in-progress/webchat-eager-start.md` — 계획 문서
- `review/code/2026/06/06/12_14_27/` 하위 파일들 — 이전 리뷰 산출물

### 발견사항

변경 범위는 전적으로 **클라이언트(채널 웹챗 위젯) 측 내부 로직**이며, 서버 API 엔드포인트·스키마·HTTP 상태 코드·인증 체계에 대한 변경은 없습니다. 구체적으로:

1. **하위 호환성**: `POST /api/hooks/:path` 엔드포인트는 그대로 유지됩니다. 변경은 클라이언트가 request body에 `firstMessage` 필드를 **더 이상 포함하지 않는 것**입니다. 서버는 이 필드를 선택적(optional)으로 처리하므로(RESOLUTION.md I14 확인: "서버는 선택적 필드로 처리하므로 하위 호환성 파손 없음"), breaking change 없음.

2. **버전 관리**: API 버전 번호 변경 없음. 엔드포인트 경로(`/api/hooks/:path`) 변경 없음.

3. **응답 형식**: 서버 응답 스키마 변경 없음. `HookStartResponse` (executionId, interaction.token, interaction.endpoints 등) 처리 로직 동일.

4. **에러 응답**: 에러 응답 처리 로직 변경 없음. HTTP 상태 코드 처리 방식 동일.

5. **요청 검증**: 요청 payload에서 `firstMessage` 필드만 제거. 서버가 선택적으로 처리하므로 검증 충돌 없음. `profile` 필드는 기존과 동일하게 포함.

6. **URL/경로 설계**: 엔드포인트 경로 변경 없음.

7. **페이지네이션**: 해당 없음. 목록 API 변경 없음.

8. **인증/인가**: `submit_message` 등 interaction 명령은 기존 동일한 `iext_*` 토큰 기반 인증을 사용. 변경 없음.

### 요약

이번 변경은 웹챗 위젯의 시작 시점을 lazy(첫 텍스트 입력)에서 eager(패널 open)로 전환하는 클라이언트 측 UX 변경입니다. 서버 API 계약 관점에서는 webhook POST payload에서 `firstMessage` 필드가 제거될 뿐이며, 서버가 해당 필드를 선택적으로 처리하므로 하위 호환성 파손이 없습니다. 엔드포인트 경로, 응답 스키마, HTTP 상태 코드 처리, 인증 체계 어느 것도 변경되지 않아 API 계약 관점의 위험 요소는 존재하지 않습니다.

### 위험도

NONE
