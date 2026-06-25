# 신규 식별자 충돌 검토 — web-chat-loader-iframe-position

검토 대상: `plan/in-progress/web-chat-loader-iframe-position.md`
검토 모드: --impl-prep

---

## 발견사항

신규 식별자 충돌에 해당하는 발견사항 없음.

### 분석 세부

**1. 요구사항 ID 충돌**
plan 문서에 신규 요구사항 ID(예: `WC-*`, `SDK-*` 형태)가 부여되지 않았다. spec 변경 없음으로 명시.
결론: 충돌 없음.

**2. 엔티티/타입명 충돌**
plan 이 제안하는 `BridgeDeps` 확장 필드(`position?: "bottom-right"|"bottom-left"`, `zIndex?: number`)는
이미 `codebase/packages/web-chat-sdk/src/types.ts:12-13`의
`BootConfig.appearance.position` / `BootConfig.appearance.zIndex` 에서 동일 리터럴·동일 의미로
정의되어 있다. 신규 이름이 아닌 기존 타입 체계 내 일관 확장이다.
결론: 충돌 없음.

**3. API endpoint 충돌**
plan 이 도입하는 변경은 클라이언트 SDK 내부 bridge 구현 수정이며 신규 REST/WebSocket endpoint가 없다.
결론: 충돌 없음.

**4. 이벤트/메시지명 충돌**
plan 이 새로 정의하는 `wc:*` 이벤트 없음. 기존 `wc:ready`, `wc:boot`, `wc:resize`, `wc:event`,
`wc:command`(`codebase/packages/web-chat-sdk/src/types.ts:53-58`) 그대로 유지.
결론: 충돌 없음.

**5. 환경변수·설정키 충돌**
plan 이 언급하는 `DEFAULT_Z_INDEX`(예시값 2147483000)는 `bridge.ts` 내 신규 파일-로컬 상수다.
동일 이름의 상수·ENV var는 코드베이스 전체에서 미발견.
결론: 충돌 없음.

**6. 파일 경로 충돌**
plan 이 새 파일을 생성하지 않는다. 수정 대상 파일
(`codebase/packages/web-chat-sdk/src/bridge.ts`, `index.ts`, `bridge.spec.ts`, `index.spec.ts`)
모두 기존 파일이며 명명 컨벤션을 그대로 유지한다.
결론: 충돌 없음.

---

## 요약

`web-chat-loader-iframe-position` plan 은 순수 버그 수정(구현이 기존 spec을 따르지 않은 오류 교정)이다.
신규 식별자(요구사항 ID, 엔티티명, endpoint, 이벤트명, ENV var, 파일 경로)를 도입하지 않으며,
확장되는 `BridgeDeps.position`/`zIndex` 필드명은 이미 동일 패키지의 `types.ts` 에 동일 의미로 존재하는
`BootConfig.appearance.position`/`zIndex` 와 완전히 일치한다. 충돌하는 식별자가 없다.

---

## 위험도

NONE
