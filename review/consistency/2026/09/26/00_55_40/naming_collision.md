# 신규 식별자 충돌 검토 — `spec-draft-integration-personal-owner-callback.md`

## 발견사항

- **[WARNING]** RBAC 표 각주 기호 `※` 재사용 — 새 각주가 기존 각주와 같은 기호를 공유해 표-각주 1:1 매핑 관례를 깬다
  - target 신규 식별자: `spec/5-system/1-auth.md` §3.2 표 아래 새로 추가하는 각주 `> ※ **Integration (Personal) 의 «자기 것»**: …`
  - 기존 사용처: 같은 파일 §3.2, `System Status ※` 행(라인 393)과 그 각주 `> ※ **System Status**: …`(라인 397). 또한 `멤버 관리 †` 행(라인 374)과 각주 `> **† Admin 멤버 삭제…**`(라인 381)
  - 상세: 이 표의 기존 관례는 "표 행에 기호를 인라인으로 붙이고, 그 기호와 동일한 기호로 시작하는 각주 문단을 표 아래에 둔다"는 **1 기호 = 1 표 행**의 1:1 매핑이다(`†` → 멤버 관리, `※` → System Status). target 은 "Integration (Personal)" 행에는 어떤 기호도 붙이지 않은 채, 이미 System Status 전용으로 쓰이고 있는 `※` 를 그대로 재사용해 새 각주를 추가한다. 그 결과 문서 안에 `※` 로 시작하는 각주가 두 개 존재하게 되고, 두 번째 각주(Integration Personal 용)는 표의 어느 행과도 기호로 연결되지 않아 독자가 "이 각주가 어떤 표 항목을 설명하는지"를 표만 보고 추적할 수 없다. 식별자 자체(요구사항 ID·엔티티명 등)의 충돌은 아니지만, 문서가 스스로 정의한 표기 컨벤션(기호↔행 매핑) 안에서 동일 기호가 서로 다른 의미로 중복 정의되는 형태라 "신규 식별자 충돌"의 관점(명명 명확화)에 해당한다.
  - 제안: (a) `Integration (Personal)` 행에 새 기호(예: `‡`)를 인라인으로 붙이고 각주도 `‡` 로 시작하거나, (b) 두 번째 항목을 정식 각주 스타일(`※`)이 아니라 별도의 인용구(`> **Integration (Personal) 의 «자기 것»**: …` — 기호 없이)로 적어 기존 `※`/`†` 각주 체계와 구분한다.

- **[INFO]** 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·ENV/설정키·파일 경로 — 신규 도입 없음, 전부 기존 식별자 재사용
  - target 은 세 spec 파일(`spec/data-flow/5-integration.md` §1.2, `spec/2-navigation/4-integration.md` §10.4, `spec/5-system/1-auth.md` §3.2)에 노트·표 행·각주만 추가하며, 사용하는 식별자(`RESOURCE_NOT_FOUND`, `ADMIN_REQUIRED`, `assertRequesterStillAllowed`, `markIntegrationCallbackError`, 앵커 `#8-권한-규칙`)는 모두 이미 코드·spec 양쪽에서 확립되어 여러 곳에서 참조되고 있는 기존 식별자다(예: `RESOURCE_NOT_FOUND`/`ADMIN_REQUIRED` 는 `4-integration.md` §8, `assertRequesterStillAllowed` 는 `integration-oauth.service.ts` 이미 구현됨). 새 요구사항 ID, 새 엔티티/DTO명, 새 endpoint, 새 이벤트명, 새 ENV var/config key, 새 spec 파일 경로 중 어느 것도 이 draft 가 신규로 부여하지 않는다. 파일명 `spec-draft-integration-personal-owner-callback.md` 도 같은 PR 의 `-assistant.md`/base `.md` 와 같은 명명 패턴을 따르며 기존 in-progress plan 파일과 충돌하지 않는다(`grep` 결과 동일 제목·경로 중복 없음).
  - 제안: 조치 불요.

## 요약

target 이 다루는 세 spec 파일에 새로 도입되는 요구사항 ID·엔티티/DTO명·API endpoint·이벤트명·ENV/설정키·spec 파일 경로는 전무하며, 인용하는 모든 식별자(`RESOURCE_NOT_FOUND`·`ADMIN_REQUIRED`·`assertRequesterStillAllowed`·`#8-권한-규칙` 앵커 등)는 기존 spec·코드에서 이미 확립된 것과 정확히 일치한다. 유일한 주의점은 `5-system/1-auth.md` §3.2 RBAC 표에 추가하는 새 각주가 "System Status" 전용으로 이미 쓰이고 있는 `※` 기호를 표 인라인 마커 없이 재사용해, 문서 자체의 "기호 1개 = 표 행 1개" 각주 관례를 깨는 것이다 — 식별자 충돌이라기보다 표기 명확성 문제이므로 WARNING 으로 등급을 매긴다.

## 위험도

LOW
