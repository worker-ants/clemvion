# Cross-Spec 일관성 검토 — `spec/7-channel-web-chat` (impl-done)

## 검토 대상 확인

이 PR("dependabot-pr-ci-fix")의 실제 구현 diff(`origin/main...HEAD`)는 **3개 파일 / 48줄**이며 전부 `package.json`
의 npm 의존성 버전 범프다:

| 파일 | 패키지 | 변경 |
|---|---|---|
| `codebase/backend/package.json` | `csv-parse` | `^7.0.1` → `^7.0.2` |
| `codebase/backend/package.json` | `nodemailer` | `^9.0.5` → `^9.1.1` |
| `codebase/channel-web-chat/package.json` | `next` | `^16.2.12` → `^16.3.3` |
| `codebase/frontend/package.json` | `next` | `^16.2.12` → `^16.3.3` |

`spec/7-channel-web-chat/**` 자체에 대한 델타는 0개 파일 — 이 PR 은 해당 spec 영역의 요구사항·계약·데이터
모델·상태기계를 전혀 변경하지 않는다. 코드 변경도 엔티티·엔드포인트·RBAC·상태 전이·계층 책임과 무관한 **의존성
patch/minor 버전 업그레이드**뿐이다(dependabot 계열 CI 수정).

## 발견사항

해당 없음 — 아래 6개 관점 전부 대상 diff 에 적용할 표면이 없다.

1. **데이터 모델 충돌**: 새로 정의되거나 수정된 엔티티/필드 없음.
2. **API 계약 충돌**: 신규·변경 endpoint/HTTP method/request-response shape 없음.
3. **요구사항 ID 충돌**: 신규 부여 요구사항 ID 없음.
4. **상태 전이 충돌**: `1-widget-app.md` §3 의 위젯 상태기계(collapsed→panel→booting→streaming↔awaiting_user_message→ended)
   등 기존 spec 서술에 영향 없음 — 코드 변경이 상태기계 로직을 건드리지 않는다(패키지 버전 문자열만 변경).
5. **권한·RBAC 모델 충돌**: 해당 없음.
6. **계층 책임 충돌**: `next` 버전이 `channel-web-chat`(위젯 SPA, Next.js CSR-only)과 `frontend`(메인 앱) 양쪽에서
   동일하게 `^16.2.12`→`^16.3.3` 로 갱신됐다. `0-architecture.md`/`1-widget-app.md` R4 가 명시한 "위젯은 별도 정적
   export 번들 — 메인 앱과 물리·개념적으로 분리"라는 경계와 상충하지 않는다: 두 패키지는 원래도 각자 독립
   `package.json` 에서 `next` 를 별도로 의존하고 있었고(모노레포 워크스페이스, 공유 코드 아님), 이번 변경도 각
   `package.json` 을 개별적으로 동일 상위 버전으로 올린 것뿐이라 "위젯 로컬 catalog"·"별도 정적 번들" 같은 분리
   불변식을 깨지 않는다. 두 영역이 우연히 같은 상위 버전을 쓰는 것은 의도된 정책 변경이 아니라 각자 dependabot 범프가
   같은 시점에 수렴한 결과로 보이며, spec 상 "Next.js 버전을 두 영역이 동기화해야 한다"는 규정도 없고 그런 요구를
   새로 만들지도 않는다.

버전 범프 자체(patch/minor semver)는 spec 문서가 참조하는 어떤 API 계약·프로토콜(`wc:*` postMessage, EIA HTTP/SSE,
`ChatInstance` 공개 타입 등)도 규정하지 않으므로 cross-spec 관점에서 재검토가 필요한 표면이 없다.

## 요약

이번 diff 는 `spec/7-channel-web-chat` 영역 코드가 걸린 3개 `package.json` 중 2개(`channel-web-chat`, `frontend`)의
`next` 버전과 `backend` 의 `csv-parse`/`nodemailer` 버전을 올리는 순수 의존성 패치로, 데이터 모델·API 계약·요구사항
ID·상태 전이·RBAC·계층 책임 그 어느 관점에서도 다른 spec 영역과 충돌하는 서술을 만들지 않는다. `spec/7-channel-web-chat/**`
자체도 변경되지 않았다(델타 0). Cross-Spec 일관성 관점에서 이 PR 은 안전하다.

## 위험도

NONE
