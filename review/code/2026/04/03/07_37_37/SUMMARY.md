# Code Review 통합 보고서

## 전체 위험도
**HIGH** - `layout` 기본값 스펙/구현 불일치(CRITICAL), XSS URL 미검증(MEDIUM), `descriptionField` 유효성 검증 누락 등 다수의 기능·보안 이슈 존재

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항·유지보수 | **`layout` 기본값 불일치**: 스펙·프론트엔드는 `'card'`를 기본값으로 정의하나, 핸들러는 `'horizontal'`을 사용. `'horizontal'`은 허용 값 목록(`card`/`image`/`minimal`)에도 없어 런타임 렌더링 오류 발생 | `carousel.handler.ts:57`, `presentation-configs.tsx:97`, `spec §1.1` | 핸들러를 `?? 'card'`로 수정하고, 관련 테스트도 `'card'`로 수정 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | **`javascript:` URL 스킴 미검증**: `escapeHtml()`은 HTML 특수문자만 처리하며 URL 스킴을 검증하지 않아 `<img src="javascript:...">` 형태의 XSS 가능 | `carousel.handler.ts` — `renderHtml()`, `execute()` | `sanitizeUrl()` 유틸 추가: `if (/^javascript:/i.test(url)) return ''` |
| 2 | 보안 | **`escapeHtml()`에서 단따옴표(`'`) 미이스케이프**: 현재 템플릿은 이중 따옴표 속성이라 직접 취약점은 아니지만, 템플릿 변경 시 인젝션 회귀 위험 | `carousel.handler.ts:110-115` | `.replace(/'/g, '&#39;')` 추가 |
| 3 | 요구사항·검증 | **Dynamic 모드 `descriptionField` 유효성 검증 누락**: 스펙은 필수(`✓`)로 정의하나 `validate()`는 `titleField`만 검증. 설정 오류가 조기에 노출되지 않음 | `carousel.handler.ts:validate()`, `spec §1.1` | 스펙을 optional(`✗`)로 수정하거나, `validate()`에 `descriptionField` 검증 로직 추가 |
| 4 | 요구사항 | **Dynamic 모드 배열 자동 탐색 미구현**: 스펙 §1.3은 최상위가 배열이 아닐 경우 배열 필드 자동 탐색을 명시하나, 구현은 `[input]`으로 단순 래핑 | `carousel.handler.ts:execute()` dynamic 분기 | 입력이 객체인 경우 값이 배열인 첫 번째 키를 자동 탐색하는 로직 추가 또는 스펙에서 명시적 완화 |
| 5 | UI·성능 | **React 리스트 `key={i}` 인덱스 사용**: 아이템 삭제/재정렬 시 React가 잘못된 DOM 재사용, 입력 포커스·상태 오염 발생 가능 | `presentation-configs.tsx` static items 렌더링 | `addItem` 시 `crypto.randomUUID()`로 `id` 생성 후 `key={item.id}` 사용 |
| 6 | 테스트 | **ESLint 억제 주석 과도 제거로 lint 실패 가능**: `(service as any)['contextService']` 코드에서 `no-explicit-any`, `no-unsafe-member-access` 주석이 제거됐으나, 코드 패턴은 여전히 두 규칙을 위반 | `execution-engine.service.spec.ts:576-579, 644-647` | 두 규칙을 다시 추가하거나, `(service as unknown as { contextService: ExecutionContextService }).contextService` 방식으로 리팩토링 |
| 7 | 스펙·문서 | **캔버스 요약 포맷이 Static 모드를 미반영**: 스펙 §7의 Carousel 요약 포맷 `{layout} · {titleField}`는 dynamic 모드에만 유효, static 모드에서 `titleField` 없음 | `spec §7`, 프론트엔드 캔버스 요약 컴포넌트 | 스펙에 static 모드 포맷 추가: `{layout} · {N} items` |
| 8 | 안정성 | **Static 모드에서 `config.items` undefined 크래시**: `validate()`를 우회하고 `execute()`가 직접 호출될 경우 `config.items.map()`에서 TypeError 발생 | `carousel.handler.ts:62` | `Array.isArray(config.items)` 가드 추가, 방어적 빈 배열 반환 |
| 9 | API 계약 | **Dynamic 모드 `image` 필드 타입 암묵적 변경**: 기존 `image: ''`(빈 문자열)에서 `image: undefined`(필드 자체 누락)로 변경 — 다운스트림 소비자에 breaking change | `carousel.handler.ts` dynamic 분기 | 스펙에 `image` 필드 optional 명시 또는 빈 문자열 유지 정책 결정 |
| 10 | UI | **모드 전환 시 이전 모드 필드 잔존**: `mode` 변경 시 `...config`로 전파되어 static→dynamic 시 `items` 잔존, dynamic→static 시 `titleField` 등 잔존 | `presentation-configs.tsx` SelectField onChange | 모드 전환 시 이전 모드 전용 필드를 명시적으로 제거 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 | **`toStr()` 유틸 함수 파일 내재화**: 다른 핸들러 확장 시 복사 발생 가능 | `carousel.handler.ts:7-14` | `handlers/presentation/utils.ts` 등 공유 모듈로 추출 검토 |
| 2 | 아키텍처 | **`mode` 파싱 로직 중복**: `validate()`와 `execute()` 양쪽에서 독립적으로 `mode` 읽음 | `carousel.handler.ts:21, 57` | `private getMode(config)` 메서드로 추출 |
| 3 | 유지보수 | **Static/Dynamic 모드 이미지 처리 패턴 불일치**: static은 `String(item.image)`, dynamic은 `toStr(item[imageField])` | `carousel.handler.ts:70, 84` | 두 모드 모두 `toStr() \|\| undefined` 패턴으로 통일 |
| 4 | 스펙 | **출력 스키마에서 `layout` 필드 누락**: 핸들러는 `layout`을 반환하나 스펙 출력 예시에 없음 | `spec §1.3` | 스펙 출력 예시에 `"layout": "card"` 추가 |
| 5 | 보안·테스트 | **`javascript:` URL XSS 테스트 케이스 누락**: 이스케이프 테스트가 태그 인젝션만 검증 | `carousel.handler.spec.ts` | `javascript:` URL이 `src`에 삽입되지 않음을 검증하는 케이스 추가 |
| 6 | 테스트 | **Dynamic 모드 null 입력 처리 미테스트**: `null` 입력 시 `null[titleField]` 접근 TypeError 가능성 | `carousel.handler.spec.ts` dynamic 섹션 | null 입력 시 빈 문자열 반환 검증 케이스 추가 |
| 7 | 테스트 | **`toStr()` 비문자열 입력 경로 미테스트**: number, boolean, object 입력 시 변환 동작 미검증 | `carousel.handler.spec.ts` | `{ count: 42 }` 등 비문자열 필드값으로 변환 결과 검증 케이스 추가 |
| 8 | 테스트 | **이미지 속성 XSS 이스케이프 테스트 누락**: `<img src alt>` 속성의 `"` 이스케이프 미검증 | `carousel.handler.spec.ts` | `'" onload="xss()'` 형태 입력 후 `&quot;` 변환 검증 케이스 추가 |
| 9 | 성능 | **`escapeHtml()` 연속 replace 비효율**: 4회 순차 `replace()`로 매번 새 문자열 생성 | `carousel.handler.ts:escapeHtml()` | 단일 정규식 + 맵 방식으로 대체: `/[&<>"]/g` |
| 10 | API 계약 | **`toStr()` 도입으로 객체 직렬화 방식 변경**: 기존 `[object Object]` → `JSON.stringify()` 결과로 달라짐 | `carousel.handler.ts:toStr()` | 스펙에 비문자열 필드 처리 정책 명시 |
| 11 | 동시성 | **React 콜백의 Stale Closure 위험**: 연속 클릭 시 렌더 시점 `items` 스냅샷으로 덮어쓰기 가능 | `presentation-configs.tsx` `addItem/removeItem/updateItem` | 부모 컴포넌트에서 함수형 업데이트(`setState(prev => ...)`) 사용 권고 |
| 12 | 아키텍처 | **테스트에서 private 멤버 직접 접근**: `(service as any)['contextService']` — 구현 세부사항과 강결합 | `execution-engine.service.spec.ts:576-579, 644-647` | `TestingModule`에서 jest spy factory 제공 또는 public API 설계 재검토 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | HIGH | `layout` 기본값 CRITICAL 불일치, `descriptionField` 미검증, 배열 자동탐색 미구현 |
| security | MEDIUM | `javascript:` URL XSS, 단따옴표 미이스케이프 |
| documentation | MEDIUM | 스펙-구현 불일치 2건 (`descriptionField` 필수 표기, static 모드 캔버스 요약 누락) |
| testing | MEDIUM | ESLint 주석 제거 후 lint 실패 가능성, static 모드 방어 코드 부재, `descriptionField` 불일치 |
| maintainability | MEDIUM | `layout` 기본값 불일치, React `key={i}`, `toStr()` 내재화 |
| concurrency | LOW | React Stale Closure 위험 (부모 계약 의존) |
| performance | LOW | React `key={i}`, `escapeHtml()` 비효율 |
| architecture | LOW | private 멤버 직접 접근, React `key={i}`, static 모드 방어 처리 누락 |
| api_contract | LOW | `image` 필드 타입 암묵적 변경, `toStr()` 직렬화 방식 변경 |
| side_effect | LOW | ESLint 주석 과도 제거, React `key={i}`, 모드 전환 시 필드 잔존 |
| scope | LOW | ESLint 주석 제거로 lint 실패 가능성 |
| dependency | NONE | 외부 의존성 변경 없음, 안전한 변경 |
| database | NONE | 데이터베이스 관련 코드 없음 |

---

## 발견 없는 에이전트

- **database** — 데이터베이스 관련 코드 변경 없음
- **dependency** — 신규 외부 의존성 없음, ESM 패턴 일관성 유지

---

## 권장 조치사항

1. **[CRITICAL] `layout` 기본값 수정**: `carousel.handler.ts:57`에서 `?? 'horizontal'` → `?? 'card'`로 수정, 관련 테스트 기대값도 `'card'`로 변경
2. **[WARNING] `javascript:` URL 스킴 검증 추가**: `renderHtml()` 내 URL 필드 사용 전 `sanitizeUrl()` 적용, 단따옴표 이스케이프(`&#39;`) 추가
3. **[WARNING] `descriptionField` 정책 결정 및 반영**: 스펙을 optional로 수정하거나 `validate()`에 검증 로직 추가 (스펙·구현 일치 필수)
4. **[WARNING] ESLint 주석 복원**: `execution-engine.service.spec.ts`에서 제거된 `no-explicit-any`, `no-unsafe-member-access` 주석 복원 후 lint 통과 확인
5. **[WARNING] React `key` 안정화**: `addItem`에서 `crypto.randomUUID()` id 부여, `key={item.id}` 사용
6. **[WARNING] Static 모드 `config.items` 방어 처리**: `execute()` static 분기 진입 시 `Array.isArray(config.items)` 가드 추가
7. **[WARNING] 스펙 §7 캔버스 요약 포맷 보완**: static 모드용 포맷 정의(`{layout} · {N} items`)
8. **[WARNING] 모드 전환 시 불필요한 필드 정리**: SelectField onChange에서 이전 모드 전용 필드 명시적 제거
9. **[INFO] 테스트 보완**: `javascript:` URL, null 입력, 비문자열 필드값, 이미지 속성 XSS 케이스 추가
10. **[INFO] Dynamic 모드 배열 자동 탐색 구현 또는 스펙 완화**: `{ items: [...] }` 형태 입력 처리 방식 결정