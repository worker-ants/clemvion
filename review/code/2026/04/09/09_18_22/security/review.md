## 보안 코드 리뷰 결과

### 발견사항

---

**[WARNING] Code 노드의 Raw JavaScript 실행 환경 샌드박싱 정책 미명시**
- 위치: `spec/5-system/4-execution-engine.md` §5.3 — `code` 핸들러에서 `code` 키를 표현식 해석 제외 처리
- 상세: Code 노드가 원시 JavaScript를 실행하는 구조임에도 스펙 어디에도 샌드박스/격리 정책이 명시되어 있지 않음. 사용자가 임의 JavaScript를 작성 가능하다면 서버 내 파일 시스템 접근, 환경 변수 탈취, 내부 네트워크 접근 등 RCE 수준의 위험 발생 가능
- 제안: `isolated-vm`, Docker 격리, Deno sandbox 등 실행 환경 격리 정책과 허용 API 목록을 스펙에 명시. `process`, `require`, `fs` 등 위험 모듈 접근 차단 정책 추가

---

**[WARNING] buttonConfig 실행 결과 보존으로 내부 포트 라우팅 ID 노출**
- 위치: `spec/4-nodes/6-presentation-nodes.md` §1.3 step 9 — `buttonConfig는 실행 결과에 보존`
- 상세: `buttonConfig.buttons`에는 포트 라우팅에 사용되는 버튼 UUID가 그대로 포함됨. 실행 내역 페이지에 이 정보가 그대로 노출되면, 공격자가 포트 ID를 사전에 파악하여 버튼 클릭 API를 위조 요청하는 데 활용될 수 있음 (`buttonItemMap` 포함)
- 제안: 실행 내역 조회 API 응답 시 `label`, `style` 등 UI 표시 필드만 포함하고 내부 포트 ID(`id`)는 서버 측에서 제거. 버튼 클릭 API는 버튼 ID 직접 노출 없이 인덱스 또는 서버 생성 토큰 기반으로 처리

---

**[WARNING] link 타입 버튼 URL 표현식의 Open Redirect / SSRF 위험**
- 위치: `spec/4-nodes/6-presentation-nodes.md` §1.6 — `url` 필드, `{{ }}` 표현식 지원
- 상세: link 타입 버튼의 URL이 `$node`, `$input` 등 표현식으로 동적 생성 가능. 워크플로우 설계자가 악의적이거나 워크플로우가 탈취된 경우, 피싱 URL이나 내부 서비스 주소(`http://internal-service/admin`)가 버튼 URL로 주입될 수 있음
- 제안: URL 유효성 검증 레이어 추가 (허용 프로토콜 `http`/`https`만, 내부 IP 대역·`localhost` 차단). 표현식으로 생성된 URL은 클라이언트 렌더링 전 서버 측 화이트리스트 검증 필요

---

**[WARNING] Route to Error Port에서 `originalInput` 전체 전달로 민감 데이터 유출 위험**
- 위치: `spec/5-system/3-error-handling.md` §3.2
- 상세: 에러 포트 출력에 `originalInput` 전체가 포함됨. 노드 입력에 API 키, 사용자 개인정보, 인증 토큰이 포함된 경우, 다운스트림 노드(Template, Webhook 등)를 통해 해당 민감 데이터가 외부로 유출될 수 있음. 에러 처리 경로는 일반 경로보다 보안 감사가 적게 이루어짐
- 제안: `originalInput`에 민감 필드 마스킹 적용 (로그 마스킹 정책인 §6.3과 동일 기준). 크기 제한 설정 (예: 64KB 초과 시 truncation)

---

**[WARNING] 실행 컨텍스트 `nodeOutputCache`의 민감 데이터 Redis 평문 저장**
- 위치: `spec/5-system/4-execution-engine.md` §6.2
- 상세: `nodeOutputCache`는 노드별 출력 전체를 Redis에 저장. API 호출 노드의 응답(토큰, PII, 결제 정보 등)이 평문으로 Redis에 TTL 기간 동안 보관됨. Redis 접근이 노출되면 실행 중인 모든 워크플로우의 민감 데이터가 일괄 유출됨
- 제안: Redis 저장 시 민감 필드 마스킹 또는 암호화 옵션 명시. 노드 설정에서 `sensitiveOutput: true` 플래그 지원 (해당 출력은 캐시하지 않거나 암호화 저장)

---

**[WARNING] Dynamic Carousel `source` 표현식을 통한 다른 노드 민감 출력 접근**
- 위치: `spec/4-nodes/6-presentation-nodes.md` §1.1 — `source: Expression` 필드
- 상세: `source` 필드가 `$node["API"].output.results` 형태로 다른 노드의 출력 전체에 접근 가능. Carousel 렌더링 결과는 사용자 인터페이스에 그대로 노출되므로, 설계 의도와 다른 노드의 출력(예: 인증 토큰이 포함된 API 응답)이 슬라이드로 렌더링되어 화면에 노출될 수 있음
- 제안: `source` 표현식 평가 결과가 배열 타입인지 런타임 검증. Presentation 노드 설정 UI에서 민감 데이터 소스 선택 시 경고 표시

---

**[INFO] `as any` 타입 캐스팅으로 인한 런타임 검증 우회**
- 위치: `review/2026-04-09_06-29-35/security/review.md` 기존 지적사항 재확인
- 상세: `(data as any).data ?? data` 패턴은 Zod 등 런타임 스키마 검증 없이 API 응답을 그대로 신뢰. 백엔드 응답이 오염된 경우(중간자 공격, 백엔드 버그) 프론트엔드가 이를 탐지할 수 없음
- 제안: API 응답에 Zod 런타임 검증 도입. `executionSchema.parse(data)` 형태로 응답 구조 보장

---

**[INFO] 페이지네이션 `totalPages` 무제한 신뢰 (DoS-like)**
- 위치: `review/2026-04-09_06-29-35/security/review.md` 기존 지적사항 재확인
- 상세: 서버 응답의 `totalPages`를 그대로 사용하여 버튼 렌더링. 비정상적으로 큰 값 주입 시 DOM 노드 폭증으로 브라우저 응답 불능 상태 발생 가능
- 제안: `const safeTotalPages = Math.min(totalPages ?? 0, 100)` 상한선 적용

---

**[INFO] Worker 태스크 메시지에 `input` 데이터 전체 포함**
- 위치: `spec/5-system/4-execution-engine.md` §4.2
- 상세: 태스크 메시지 구조에 `"input": { ... }` 전체가 포함. 큐(Redis Sorted Set) 접근이 노출되거나 Worker 로그에 태스크 메시지가 기록되는 경우 민감 입력 데이터 유출 가능
- 제안: 큐 메시지에는 `inputRef`(캐시 키)만 포함하고, Worker가 Redis에서 직접 조회하는 간접 참조 방식 검토. 큐 접근에 별도 인증/암호화 채널 사용 여부 명시

---

### 요약

스펙 문서와 리뷰 파일을 종합한 보안 분석 결과, 가장 심각한 위험은 **Code 노드의 서버 측 JavaScript 실행 환경 미명시**로 샌드박싱 정책이 구현되지 않을 경우 RCE로 이어질 수 있다. 그 외 **buttonConfig 내부 포트 ID 노출**, **link 버튼 URL 표현식 인젝션**, **Route to Error Port의 originalInput 민감 데이터 전달**, **nodeOutputCache Redis 평문 저장**이 설계 레벨에서 보완이 필요한 보안 이슈다. 기존 security 리뷰(file 7)에서 지적한 프론트엔드 레벨의 Open Redirect, 파라미터 미검증, 서버 에러 메시지 노출 이슈는 여전히 유효하며, 스펙 설계 레벨의 이슈와 함께 우선순위를 정해 대응이 필요하다.

### 위험도

**HIGH**