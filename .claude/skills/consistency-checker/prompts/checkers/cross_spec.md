# Cross-Spec Consistency Check

당신은 cross-spec 일관성을 점검하는 검토자입니다. 아래 **target 문서(draft)** 가 기존 `spec/**` 의 다른 영역 문서들과 충돌하는지 분석하세요.

## 검토 모드
{mode}

## Target 문서
경로: {target_path}

```
{target_doc}
```

## 관련 spec 본문 (다른 영역 포함)

{related_specs}

## 검토 지침

다음 cross-spec 관점을 점검하세요:

1. **데이터 모델 충돌** — target 이 정의하는 엔티티·필드가 다른 영역의 동일 엔티티 정의와 모순되는가
2. **API 계약 충돌** — endpoint, HTTP method, request/response shape 이 다른 spec 의 정의와 어긋나는가
3. **요구사항 ID 충돌** — 요구사항 ID(예: `NAV-*`, `ED-AI-*`) 가 다른 영역에서 다른 의미로 이미 사용 중인가
4. **상태 전이 충돌** — 같은 도메인 엔티티의 상태 머신이 영역마다 다르게 기술되어 있는가
5. **권한·RBAC 모델 충돌** — 새 권한 구조가 기존 RBAC 규칙과 어긋나는가
6. **계층 책임 충돌** — frontend/backend 경계, 노드 카테고리 간 책임 분할이 기존 결정과 일치하는가

## 등급 기준

- **CRITICAL** — 기존 spec 과의 직접 모순. 그대로 채택하면 두 영역 중 하나가 작동 불가.
- **WARNING** — 잠재 충돌이나 정의 중복. 명시적 우선순위 결정이 필요.
- **INFO** — 명명 비일관성, 동기화 권장 사항 등.

## 출력 형식

### 발견사항

- **[CRITICAL/WARNING/INFO]** 간단한 제목
  - target 위치: target 문서 내 섹션/라인
  - 충돌 대상: 충돌하는 다른 spec 의 파일·섹션
  - 상세: 어떤 식으로 모순되는가
  - 제안: target 을 어떻게 고치거나, 어느 spec 을 함께 갱신해야 하는가

### 요약
1 문단으로 cross-spec 관점의 전체 평가.

### 위험도
NONE / LOW / MEDIUM / HIGH / CRITICAL
