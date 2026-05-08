# Spec: Text Classifier

> 관련 문서: [AI 공통 규약](./0-common.md) · [Spec 노드 개요](../0-overview.md) · [Spec LLM Config](../../2-navigation/6-config.md)

LLM을 사용하여 입력 텍스트를 미리 정의된 카테고리로 분류. Single-label (기본) 또는 Multi-label 모드를 지원.

---

## 1. 설정 (config)

| 필드 | 타입 | 설명 |
|------|------|------|
| llmConfigId | UUID | 사용할 LLM 프로바이더 설정. [공통 §1](./0-common.md#1-llm-모델config-선택) |
| model | String | 모델 ID |
| inputField | Expression | 분류할 텍스트 필드 |
| categories | CategoryDef[] | 분류 카테고리 목록 |
| instructions | String? | 추가 분류 지시사항 |
| includeConfidence | Boolean | 신뢰도 점수 포함 여부 (기본: false) |
| includeEvidence | Boolean | 분류 근거(입력에서 발췌한 단어/문장) 포함 여부 (기본: false) |
| multiLabel | Boolean | Multi-label 분류 모드 (기본: false) |

**CategoryDef 구조:**

| 필드 | 타입 | 설명 |
|------|------|------|
| id | String? | 카테고리 안정 id. 출력 포트 핸들 (`source_port`) 로 사용. 누락 시 `class_${i}` fallback. 형식: `[a-zA-Z0-9_-]+`, 최대 64자. **설정 UI 에 노출되지 않으며 (hidden) AI Assistant 가 자동 지정**. 카테고리 간 id 중복 금지 (resolver dedupe 가 두 번째 포트를 silent 로 떨어뜨려 핸들러 라우팅과 어긋남). |
| name | String | 카테고리 이름 (출력 포트 라벨). `__none__`은 예약어로 사용 불가 |
| description | String | 카테고리 설명 (LLM에게 제공) |
| examples | String[] | 예시 텍스트 목록 |

> ⚠ **마이그레이션 주의**: 기존 워크플로우의 카테고리에 후속으로 `id` 를 추가하면 출력 포트 id 가 `class_${i}` → 사용자 지정 id 로 바뀐다. 그 카테고리에 연결된 기존 엣지(`source_port: class_0` 등)는 dangling 상태가 되므로 엣지를 수동 재연결해야 한다. 신규 카테고리에는 처음부터 `id` 를 지정해 두면 안전.

## 2. 설정 UI

```
┌──────────────────────────────────────────┐
│  Text Classifier                         │
│  ──────────────────────────────────────  │
│                                          │
│  LLM Provider: [OpenAI ▼]               │
│  Model:        [gpt-4o-mini ▼]          │
│                                          │
│  Input: [{{ $input.text }}]              │
│                                          │
│  □ Include confidence score              │
│  □ Include classification evidence       │
│  □ Multi-label Classification            │
│                                          │
│  ── Categories ──                        │
│  ┌──────────────────────────────────────┐│
│  │ 1. Billing                           ││
│  │    Desc: "결제, 환불, 구독 관련 문의" ││
│  │    Examples: "환불 요청", "결제 실패" ││
│  ├──────────────────────────────────────┤│
│  │ 2. Technical                         ││
│  │    Desc: "기술적 문제, 버그 리포트"   ││
│  │    Examples: "로그인 안됨", "에러"    ││
│  ├──────────────────────────────────────┤│
│  │ 3. General                           ││
│  │    Desc: "일반 문의, 기능 요청"       ││
│  └──────────────────────────────────────┘│
│  [+ Add Category]                        │
│                                          │
└──────────────────────────────────────────┘
```

## 3. 포트
- 입력: `in` (1개)
- 출력:
  - `<category.id>` 또는 `class_${i}` (카테고리별 동적 포트) — 데이터 타입. `category.id` 가 지정되어 있으면 그 값을 그대로 사용, 누락 시 인덱스 기반 fallback (`class_0`, `class_1`, ...). resolver/handler 모두 동일 규칙으로 발급한다.
  - `fallback` (정적) — 어떤 카테고리에도 매칭되지 않을 때
  - `error` (정적) — LLM API 오류, 타임아웃 등 발생 시 (에러 타입)

## 4. 실행 로직

### 4.1 Single-label 모드 (기본)
1. 카테고리 정보를 포함한 분류 프롬프트 구성
2. JSON schema enum에 `__none__` 센티널을 포함하여 LLM이 해당 없음을 명시적으로 표현 가능
3. LLM 호출 (실패 시 `error` 포트로 라우팅)
4. 응답에서 분류 결과 파싱
5. 해당 카테고리의 출력 포트로 데이터 전달
   - LLM이 `__none__`을 반환하거나 매칭 실패 시 → `fallback` 포트

### 4.2 Multi-label 모드 (multiLabel: true)
1. 해당하는 모든 카테고리를 선택하도록 프롬프트 구성
2. LLM 호출 (실패 시 `error` 포트로 라우팅)
3. 응답에서 카테고리 배열 파싱
4. 매칭된 모든 카테고리의 출력 포트를 동시에 활성화
   - 매칭 없음 (빈 배열) → `fallback` 포트

## 5. 출력 구조

LLM 3개 노드 공통 규약([공통 §5](./0-common.md#5-응답-형식-규약-principle-11), CONVENTIONS §8)에 따라 도메인 결과는 `output.result.*` wrapper 하위에 둔다.

### 5.1 Single-label 모드

```json
{
  "result": {
    "category": "Billing",
    "confidence": 0.95,
    "evidence": ["환불"],
    "originalInput": "환불 요청드립니다"
  }
}
```

- `category`는 매칭 실패 시 `null`
- `confidence` 는 `includeConfidence: true` 일 때만 포함
- `evidence` 는 `includeEvidence: true` 일 때만 포함. 매칭 실패(`category: null`) 또는 LLM이 비워서 반환한 경우 빈 배열 `[]`

### 5.2 Multi-label 모드

```json
{
  "result": {
    "categories": [
      { "name": "Billing", "confidence": 0.95, "evidence": ["환불"] },
      { "name": "General", "confidence": 0.7, "evidence": ["요청"] }
    ],
    "originalInput": "환불 요청드립니다"
  }
}
```

- `categories`는 매칭 없음 시 빈 배열 `[]`
- 각 항목의 `confidence`/`evidence` 는 각각 `includeConfidence`/`includeEvidence` 가 `true` 일 때만 포함
