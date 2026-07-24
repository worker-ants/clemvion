# Cross-Spec 일관성 검토 — spec/7-channel-web-chat/ (apiBase 세션 바인딩)

## 검토 대상 요약
diff 는 `codebase/channel-web-chat` 위젯의 client 세션(`PersistedSession`)에 **발급 `apiBase`(origin) 바인딩**을
추가한다 — `session-store.ts` 에 `apiBase` 필드 신설 + `loadSession(triggerEndpointPath, expectedApiBase, storage?)` 로
시그니처 변경, `stripTrailingSlash` 정규화 헬퍼를 `api-base.ts` 로 단일화. 백엔드·다른 영역 코드 변경 없음 — 순수
client-only 하드닝.

## 발견사항

교차 검토 결과 다른 spec 영역과의 직접 충돌은 발견되지 않았다.

- **[INFO]** 신규 동작이 target 영역 내부에서는 이미 spec·코드가 정합 — 참고 확인용 기록
  - target 위치: `spec/7-channel-web-chat/3-auth-session.md` §3.1 1번 항목("저장 세션은 발급된 `apiBase`(origin)에
    묶인다…")
  - 충돌 대상: 없음(교차 충돌 아님) — diff 코드(`session-store.ts`/`use-widget.ts`)와 1:1 대응
  - 상세: diff 가 구현한 origin-binding(불일치·미기록 시 폐기, trailing-slash 만 정규화하고 경로는 보존)이 spec
    §3.1 산문과 정확히 일치한다. `git diff origin/main...HEAD -- <code_areas>` 필터가 spec 변경분을 가리는 것일 뿐,
    target 문서 본문(HEAD 상태)엔 이미 반영돼 있어 spec-code drift 가 없다.
  - 제안: 없음(정보성 확인).

- **[INFO]** `stripTrailingSlash` vs `app/demo/demo-config.ts::normalizeApiBase` 네이밍 근접 — 이미 처리됨
  - target 위치: `codebase/channel-web-chat/src/lib/session-store.ts` 주석(diff L1764-1767)
  - 충돌 대상: `codebase/channel-web-chat/src/app/demo/demo-config.ts`(spec `code:` 프런트매터에 미등재 — 어느
    7-channel-web-chat 문서에도 이 파일이 SoT 코드로 지목되지 않음)
  - 상세: 두 함수가 유사한 이름·유사한 목적(apiBase 정규화)이나 계약이 다르다(`stripTrailingSlash`=trailing `/`
    만 제거해 경로 보존, `normalizeApiBase`=후행 `/api` 까지 제거). diff 주석이 이전 consistency-check
    (`22_35_51 naming_collision CRITICAL`)를 인지하고 의도적으로 통합하지 않은 근거를 남겨뒀다 — 이미 처분된
    항목이라 본 세션에서 재-flag 하지 않는다. demo 페이지는 어떤 `7-channel-web-chat/*.md` 의 `code:` 목록에도
    없어 spec-code 매핑 대상이 아니므로 cross-spec 등급 상향 근거 없음.
  - 제안: 없음(재확인만) — 향후 두 함수 중 하나를 진짜로 통합하려는 리팩터가 들어오면 이 diff 주석을 먼저 참조하게
    문서화 상태 유지를 권장.

## 점검한 교차 영역 (충돌 없음 확인)

- **데이터 모델**: `PersistedSession.apiBase`(client `sessionStorage`, 신규)는 서버 `execution_token`
  엔티티(`spec/1-data-model.md` §2.13.2, jti 기반)와 계층·필드가 겹치지 않는다 — origin 바인딩은 client 전용이며
  서버 토큰 모델에 상응 필드가 없고 필요하지도 않다(서버는 jti blacklist 로 무효화, client 는 origin 오전송만 방지).
- **API 계약**: EIA(`spec/5-system/14-external-interaction-api.md` §5.3 상태조회·§8.3 토큰 규약)는 origin/apiBase
  개념을 정의하지 않으며, 이번 diff 도 EIA 요청/응답 shape 를 바꾸지 않는다(순수 client 판단 로직).
  `loadSession` 시그니처 변경의 유일한 프로덕션 호출부(`use-widget.ts`)는 diff 내에서 이미 갱신됨 — 잔존 호출부
  없음(`git grep loadSession(` 확인).
- **요구사항 ID**: 신규 EIA-*/WH-* 등 ID 부여 없음 — 충돌 후보 없음.
- **상태 전이**: 위젯 conversation lifecycle(§3 상태기계, `1-widget-app.md`)은 변경되지 않는다 — origin 불일치 시
  "폐기 후 신규 시작"은 기존에도 존재하던 "저장 세션 없음" 분기를 타므로 새 상태·전이가 생기지 않는다.
  `2-sdk.md` §3 "`wc:boot` 재전송(위젯은 마지막 config 적용)" 계약과도 상충하지 않는다 — 재전송이 origin 을
  포함해 실제로 바뀌는 경우를 위한 안전장치일 뿐, 재전송 자체의 계약(host origin pin·postMessage 검증)은 건드리지
  않는다.
- **권한/RBAC**: 무관 — 이번 변경은 클라이언트 스토리지 로직뿐, `5-admin-console.md` §7 RBAC 규칙과 접점 없음.
- **계층 책임**: 변경 전량이 `codebase/channel-web-chat`(client) 내부에 머무른다 —
  `0-architecture.md` R2("클라이언트 consumer 로 한정 — EIA·facade 미신설")·§1 레이어 분리표와 정합. 백엔드
  `WEB_CHAT_WIDGET_ORIGINS`/CORS(`4-security.md` §2) 등 서버측 origin 검증과는 별개 층위(서버=CORS 허용,
  클라이언트=세션 재사용 여부)라 중복·모순 없음.

## 요약
diff 는 `spec/7-channel-web-chat/` 영역 내부에 한정된 client-only 하드닝(세션의 발급 `apiBase` 바인딩)이며,
target 문서(`3-auth-session.md` §3.1)에 이미 정확히 반영돼 있어 spec-code 정합성이 확인된다. EIA·데이터 모델·RBAC·
상태기계·계층 책임 등 다른 spec 영역과 비교했을 때 필드명·계약·경계 어디에서도 직접 모순이나 잠재 충돌이
발견되지 않았다. 유일한 네이밍 근접(`stripTrailingSlash` vs `demo-config.ts normalizeApiBase`)은 이전 세션에서
이미 검토·처분되었고 spec 코드 매핑 대상도 아니어서 등급 상향 근거가 없다.

## 위험도
NONE
