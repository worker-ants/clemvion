# 정식 규약 준수 검토 결과

검토 모드: `--impl-prep`
대상 범위: `03 M-1 — integration-oauth.service.ts handleInstall(cafe24) · handleMakeshopInstall` 의 identical 보일러플레이트 4종 private helper 추출 (behavior-preserving)

참조 spec: `spec/4-nodes/4-integration/4-cafe24.md §9.8`, `spec/4-nodes/4-integration/5-makeshop.md §9.7`, `spec/conventions/error-codes.md §2`

---

## 발견사항

### 1. INFO: 추출할 private helper 명명 — 의미 기반 이름 권장

- **target 위치**: 계획된 구현 (아직 코드 미작성)
- **관련 규약**: `spec/conventions/error-codes.md §1` 의미 기반 명명 원칙 + 프로젝트 전반의 TypeScript private method 명명 관례 (`camelCase`, 동사 시작)
- **상세**: 추출될 4개 helper 는 각각 ① timestamp ±5min 윈도우 검사, ② nonce replay 검사, ③ post-install navigation redirect, ④ reauthorize state 생성/저장이다. 기존 코드에는 이미 의미 기반 이름의 private helper 들이 혼재한다 (`logHmacFailure`, `tryRecoverByMallId`, `findConnectedMakeshopShopIntegration` 등). 새 helper 도 동일하게 동사+명사 의미 표현을 써야 하며 — 예를 들어 구현 위치("handleInstall 에서 쓰임") 를 이름에 박으면 `error-codes.md §1` 원칙 ("구현 세부·전이적 맥락을 이름에 박지 않는다") 과 동형의 이름 품질 문제가 생긴다. `checkTimestampWindow`, `checkNonceReplay`, `buildAndSaveInstallOAuthState`, `redirectPostInstallNavigation` 류의 동사+의미 이름을 권장한다.
- **제안**: helper 를 구현할 때 기능 의미(what it does)를 이름으로, 구현 경로(where it is called)는 이름에 포함하지 않는다. 규약 갱신 불필요 — 현행 `error-codes.md §1` 의미 기반 원칙과 프로젝트 내 기존 private method 명명 패턴이 이미 올바른 가이드다.

---

### 2. INFO: 4-cafe24.md §9.8 의 "§9.8" 절 내용이 HMAC 검증이지 helper 추출 허가가 아님 — 참조 의도 확인 필요

- **target 위치**: 작업 계획 설명의 "spec: 4-cafe24.md §9.8" 인용
- **관련 규약**: CLAUDE.md "정보 저장 위치 (단일 진실 원칙)" — spec 참조 표기 정확성
- **상세**: `spec/4-nodes/4-integration/4-cafe24.md §9.8` 의 실제 내용은 "Private 앱 App URL HMAC 검증" 절이다. 이 절은 HMAC 알고리즘·보안 추가 조치·식별 전략·관련 코드 상수를 정의한다. 작업 범위 설명("§9.8 — VERIFY-pending HMAC 격리")은 spec 의 HMAC 격리 요구사항을 그 절에서 인용하는 것으로 해석되며 이는 내용상 일치한다. 그러나 makeshop spec 의 §9.7 은 "미확인 항목(production 전 검증 필요)" 절로 내용이 다르다 — HMAC 메시지 구성이 아직 `VERIFY` 마킹인 점을 인용한 것으로 해석 가능하다.
- **제안**: 참조 정확성 상 문제없음. 단 구현 시 `buildMakeshopHmacMessage` 분리는 `§9.7 VERIFY` 마킹 함수이므로 helper 추출 후에도 함수 본문에 `VERIFY` 주석을 그대로 유지해야 한다 — 추출이 VERIFY 마킹을 지워선 안 된다.

---

### 3. INFO: `spec/conventions/error-codes.md §2` 안정성 정책 — 추출 시 에러 코드 값 유지 확인

- **target 위치**: 작업 계획 중 "에러코드 prefix(CAFE24_*/MAKESHOP_*) 유지" + "error-codes.md §2 prefix rename 금지"
- **관련 규약**: `spec/conventions/error-codes.md §2` — "에러 코드 rename 은 breaking change 다"
- **상세**: 현재 코드에서 `handleInstall` 과 `handleMakeshopInstall` 이 각각 발행하는 에러 코드 (`CAFE24_INSTALL_REPLAY`, `CAFE24_INSTALL_INVALID_TOKEN`, `CAFE24_INSTALL_INVALID_HMAC`, `MAKESHOP_INSTALL_REPLAY`, `MAKESHOP_INSTALL_INVALID_TOKEN`, `MAKESHOP_INSTALL_INVALID_HMAC`) 는 이미 `error-codes.md §1` 의미 기반 명명을 잘 따른다. 작업 계획이 이 코드들을 유지하겠다고 명시한 것은 §2 요구와 정확히 부합한다. 규약 위반 없음.
- **제안**: helper 추출 시 `throw new BadRequestException({ code: 'CAFE24_INSTALL_REPLAY', ... })` 등 에러 발행 지점이 helper 내부로 이동하더라도 코드 값 문자열 자체는 변경 없이 그대로 두어야 한다. 에러 발행 위치 이동은 breaking 이 아니나 코드 문자열 변경은 breaking 이다 — helper 시그니처가 에러를 throw 하는지 아니면 boolean 을 반환하고 caller 가 throw 하는지는 §2 에 무관하나, 코드 문자열 통과 여부를 PR 차이로 확인하는 것이 안전하다.

---

## 요약

이번 검토 대상은 기존 spec 문서가 아닌 **계획 단계 구현 범위 설명**이며, 참조된 spec/conventions 파일은 올바른 경로를 가리킨다. 정식 규약 직접 위반(CRITICAL/WARNING) 은 없다. 세 가지 INFO 사항은 모두 구현 착수 전 사전 주의로 — ① 추출할 helper 이름을 의미 기반으로, ② `buildMakeshopHmacMessage` 의 `VERIFY` 주석 유지, ③ 에러 코드 문자열 값 변경 없는 추출 — 이 세 조건이 구현 중 지켜지면 규약 준수 상태로 완료된다. 추출 범위 자체(4종 보일러플레이트, HMAC·provider guard·로그 메커니즘 유지)는 `error-codes.md §2` 안정성 정책 및 café24 spec §9.8 / makeshop spec §9.7 VERIFY 마킹과 충돌하지 않는다.

## 위험도

NONE
