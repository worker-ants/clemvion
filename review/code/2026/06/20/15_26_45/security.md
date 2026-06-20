# 보안(Security) 리뷰 — M-5 레이어1 노드 DI 전환

## 발견사항

### [INFO] DI 토큰 string literal 사용
- 위치: `/codebase/backend/src/nodes/core/node-component.interface.ts` — `export const NODE_COMPONENT = 'NODE_COMPONENT'`
- 상세: DI 토큰이 string literal 이다. 동일 문자열을 가진 서드파티 모듈이나 미래 동적 노드 등록 경로(레이어3)가 합류할 경우, 악의적 또는 우발적 토큰 충돌로 신뢰되지 않은 `NodeComponent` 배열이 `NodeBootstrapService` 에 주입될 가능성이 이론적으로 존재한다. 현재 레이어1 범위(정적 빌트인 카탈로그만)에서는 실질 위협이 아니다 — 기존 `WORKFLOW_EXECUTOR` string 토큰 컨벤션을 답습한 설계이며, 이전 리뷰(15_14_06 SUMMARY INFO·RESOLUTION 후속)도 "레이어3 시 Symbol 전환 검토"로 기록했다.
- 제안: 레이어3(`registerDynamic`) 도입 시 `Symbol('NODE_COMPONENT')` 또는 namespace 분리된 토큰으로 전환해 외부 주입 오염을 구조적으로 차단한다. 현재 레이어1에서는 조치 불요.

### [INFO] `NodeComponentsModule` 단일 `useValue` 카탈로그 — 레이어3 동적 등록 seam
- 위치: `/codebase/backend/src/nodes/node-components.module.ts` — `{ provide: NODE_COMPONENT, useValue: ALL_NODE_COMPONENTS }`
- 상세: 현재 레이어1은 정적 빌트인 카탈로그만 주입한다. 레이어3에서 `registerDynamic` 으로 워크스페이스별 커스텀 노드를 런타임 등록할 때, 입력 스키마 검증·화이트리스트·인가(workspace 소유 확인) 없이 `NodeComponent` 가 registry 에 등록되면 임의 핸들러 실행으로 이어질 수 있다. 이 seam 은 현재 미구현이므로 레이어1 단계 취약점이 아니다.
- 제안: 레이어3 구현 시 `registerDynamic` 진입점에 (1) 컴포넌트 스키마 검증, (2) 허용 타입 화이트리스트, (3) 워크스페이스 인가 검사를 필수 적용한다.

### [INFO] `sortComponents` — `localeCompare` 정렬 결정성
- 위치: `/codebase/backend/src/modules/execution-engine/node-bootstrap.service.ts` — `a.metadata.type.localeCompare(b.metadata.type)`
- 상세: `localeCompare` 는 locale 환경 설정에 따라 결과가 달라질 수 있다. 공격 표면은 없으나, 운영 환경의 locale 설정이 비표준인 경우 팔레트 순서가 달라져 예상치 못한 동작이 발생할 수 있다. 보안 위협보다는 결정성 문제이며, 현재 `metadata.type` 은 ASCII 범위 slug 이므로 실질 위험 없다.
- 제안: 필요 시 `localeCompare(b, 'en', { sensitivity: 'variant' })` 로 locale 고정해 완전 결정적 정렬을 보장한다.

## 요약

이번 변경은 내부 DI 배선 리팩터(behavior-preserving)로, 인젝션 취약점·하드코딩 시크릿·인증/인가 변경·입력 검증 우회·OWASP Top 10 해당 항목·암호화·에러 처리·알려진 취약 라이브러리 추가가 전혀 없다. 코드 흐름 변화는 `ALL_NODE_COMPONENTS` 정적 import 를 `NODE_COMPONENT` DI 주입으로 교체한 것뿐이며, 부팅 시 확정된 정적 카탈로그를 바인딩하므로 런타임 외부 입력 주입 경로가 없다. 유일한 미래 관련 사항은 string DI 토큰과 레이어3 동적 등록 seam 이나, 둘 다 현재 레이어1 범위에서는 실질 위협이 아님을 이전 리뷰(15_14_06)에서도 확인했다.

## 위험도

NONE
