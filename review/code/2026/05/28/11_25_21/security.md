# 보안(Security) 리뷰 — cafe24-mcp-label-i18n

검토 일시: 2026-05-28
대상 파일: 28개 (metadata 18개 + public-meta + types + frontend + plan + consistency)

---

## 발견사항

**[INFO]** 하드코딩된 한국어 label 제거 — 긍정적 변화
- 위치: 모든 metadata 파일 (`application.ts`, `category.ts`, `collection.ts` 등 18개 파일)
- 상세: 기존에 `label: '설치된 앱 목록 조회'` 형태로 백엔드 메타데이터에 하드코딩되어 있던 로케일 종속 문자열이 제거됨. API 응답에서 언어 정보가 분리되어 보안 관점보다는 아키텍처 관점에서 올바른 방향. 이전 상태에서는 label이 `/nodes/definitions` API 응답에 그대로 노출되었으나 민감 정보는 포함되지 않으므로 직접적인 보안 리스크는 없었음.

**[INFO]** `resolveCafe24OperationLabel` 함수 — dict 직접 import 방식
- 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` 신규 함수
- 상세: 두 개의 i18n dict 파일(`cafe24CatalogKo`, `cafe24CatalogEn`)을 정적 import 후 `locale` 값에 따라 조회. `dict[labelKey] ?? labelKey` 패턴으로 fallback 처리. `labelKey`는 서버에서 내려오는 값이므로, 악의적인 서버 응답이 `dict[malicious_key]` 형태로 임의 키를 조회할 수 있는지 검토함. 그러나 dict는 정적 컴파일 타임 객체이고 조회 결과가 단순 문자열 렌더링에만 쓰이므로 prototype pollution 위험은 없음. React의 JSX 렌더링은 자동 이스케이프를 적용하므로 XSS도 없음.
- 제안: 추가 방어를 원한다면 `labelKey.startsWith('cafe24.')` 검사를 추가할 수 있으나 현재 구조상 필수는 아님.

**[INFO]** `labelKey` 생성 로직 — template literal interpolation
- 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/public-meta.ts`, `labelKey: \`cafe24.${resource}.${op.id}\`` 라인
- 상세: `resource`와 `op.id` 값은 `Cafe24Resource` 타입 및 컴파일 타임 상수 배열에서 유래함. 런타임에 사용자 입력이 개입하지 않으므로 인젝션 위험이 없음. 다만 미래에 `resource`나 `op.id`가 동적 출처로 변경될 경우 이 template 구성은 재검토가 필요함.

**[INFO]** fallback 정책 — labelKey 원문 노출
- 위치: `integration-configs.tsx` `resolveCafe24OperationLabel`, `public-meta.ts` 주석
- 상세: dict miss 시 `cafe24.<resource>.<id>` 형식 key가 UI에 그대로 표시됨. 이 fallback 문자열 자체에 민감 정보는 없으나, 내부 ID 네이밍 컨벤션이 최종 사용자에게 노출됨. 보안보다는 UX 문제이며, 기존 설계 결정(spec §7.5)에서 의도적으로 채택한 방식임.

**[INFO]** 테스트 파일 변경 — 민감 정보 없음
- 위치: `constraint-validator.spec.ts`, `public-meta.spec.ts`, `cafe24-config.test.tsx`
- 상세: `label` → `labelKey` 치환이 stub/fixture에 반영됨. 하드코딩된 시크릿, 자격증명, 토큰 없음.

**[INFO]** 인증/인가 체계 변경 없음
- 상세: 이번 diff는 label 표현 방식만 변경하며, `scopeType`, `method`, `path`, `requiredFields`, `restrictedApproval` 등 인가 관련 필드는 전혀 수정되지 않음. `restrictedApproval` 경고 표시 로직(`⚠` suffix)도 그대로 유지됨.

---

## 요약

이번 변경은 backend metadata 파일에서 한국어 하드코딩 `label` 필드를 일괄 제거하고 API 응답에 `labelKey`(`cafe24.<resource>.<id>` 형식)를 도입하며, frontend에서 정적 i18n dict를 통해 사람이 읽을 수 있는 라벨을 조회하도록 전환하는 순수 리팩터링이다. 인젝션, 하드코딩된 시크릿, 인증/인가 변경, 암호화 알고리즘, 민감 정보 노출, 알려진 취약점 라이브러리 신규 도입이 없다. `resolveCafe24OperationLabel`의 `dict[labelKey]` 조회는 정적 컴파일 타임 객체를 대상으로 하고 결과가 React에서 이스케이프되어 렌더링되므로 XSS나 prototype pollution 위험이 없다. `labelKey` template 구성에 쓰이는 `resource`와 `op.id`는 컴파일 타임 상수에서 유래하므로 서버사이드 인젝션도 없다. 보안 관점에서 특별히 우려할 사항이 발견되지 않았다.

---

## 위험도

NONE
