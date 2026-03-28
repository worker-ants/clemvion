# Spec: Data 노드

> 관련 문서: [PRD Data 노드](../../prd/3-node-system.md#7-data-노드-2종) · [Spec 노드 개요](./0-overview.md) · [Spec 노드 공통](../3-workflow-editor/1-node-common.md) · [Spec 노드 샌드박싱](./0-overview.md#5-노드-실행-샌드박싱)

---

## 1. Transform

입력 데이터에 변환 연산(operations)을 순차적으로 적용하여 출력한다. 코딩 없이 시각적 빌더 UI를 통해 데이터를 재구조화할 수 있다.

### 1.1 Config

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| operations | Operation[] | ✓ | [] | 변환 연산 체인 (순차 적용) |

### 1.2 Operation 정의

각 Operation은 `type`과 해당 타입별 `params`로 구성된다.

| type | params | 설명 |
|------|--------|------|
| `rename_field` | `from` (String), `to` (String) | 필드 이름 변경 |
| `remove_field` | `field` (String) | 필드 제거 |
| `set_field` | `field` (String), `value` (표현식) | 필드 값 설정 (신규 생성 또는 덮어쓰기) |
| `type_convert` | `field` (String), `targetType` (string / number / boolean / array / object) | 타입 변환 |
| `string_op` | `field` (String), `operation` (trim / uppercase / lowercase / replace / split / join), `args` (Object) | 문자열 조작 |
| `math_op` | `field` (String), `operation` (add / subtract / multiply / divide / round / ceil / floor), `operand` (Number, 표현식) | 수학 연산 |
| `date_op` | `field` (String), `operation` (format / add / subtract / diff), `args` (Object) | 날짜 조작 |
| `array_filter` | `field` (String), `condition` (조건 표현식) | 배열 필터링 |
| `array_sort` | `field` (String), `sortBy` (String?), `order` (asc / desc) | 배열 정렬 |
| `object_pick` | `field` (String?), `keys` (String[]) | 객체에서 특정 키만 선택 |

**string_op args:**

| operation | args |
|-----------|------|
| trim | — |
| uppercase | — |
| lowercase | — |
| replace | `search` (String), `replacement` (String), `all` (Boolean) |
| split | `separator` (String) |
| join | `separator` (String) |

**date_op args:**

| operation | args |
|-----------|------|
| format | `pattern` (String, 예: "YYYY-MM-DD HH:mm:ss") |
| add | `amount` (Number), `unit` (years / months / days / hours / minutes / seconds) |
| subtract | `amount` (Number), `unit` |
| diff | `compareField` (String), `unit` |

### 1.3 포트 정의

| 포트 | 방향 | 식별자 | 설명 |
|------|------|--------|------|
| Input | 입력 | `in` | 입력 데이터 |
| Output | 출력 | `out` | 변환 완료된 데이터 |

### 1.4 실행 로직

1. 입력 데이터를 복제 (원본 불변)
2. `operations` 배열을 순서대로 적용
3. 각 연산은 이전 연산의 결과를 입력으로 받음
4. 최종 결과를 출력 포트로 전달

### 1.5 설정 UI — 시각적 빌더

```
┌──────────────────────────────────────┐
│  Transform Operations                │
│  ────────────────────────────────── │
│  1. [rename_field ▼] from → to       │
│     [user.name___] → [userName___]   │
│                              [✕] [↕] │
│  ────────────────────────────────── │
│  2. [set_field ▼]                    │
│     field: [fullName___]             │
│     value: [{{ $input.first + " "... │
│                              [✕] [↕] │
│  ────────────────────────────────── │
│  3. [remove_field ▼]                 │
│     field: [tempData___]             │
│                              [✕] [↕] │
│  ────────────────────────────────── │
│  [+ Add Operation]                   │
│                                      │
│  ─── Preview ───────────────────── │
│  Input:  { "user": { "name": "Kim" } │
│  Step 1: { "userName": "Kim" }       │
│  Step 2: { "userName": "Kim",        │
│            "fullName": "Kim ..." }   │
│  Step 3: { "userName": "Kim",        │
│            "fullName": "Kim ..." }   │
└──────────────────────────────────────┘
```

- 각 연산을 카드 형태로 표시
- 드래그로 순서 변경 가능 (`[↕]` 핸들)
- 각 카드 삭제 버튼 (`[✕]`)
- `+ Add Operation` 버튼으로 연산 추가
- 하단 Preview: 마지막 실행 데이터 기준으로 각 단계별 결과 미리보기

---

## 2. Code

JavaScript 코드를 작성하여 자유로운 데이터 처리를 수행한다. Transform 노드로 표현하기 어려운 복잡한 로직에 사용한다.

### 2.1 Config

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| language | Enum | ✓ | javascript | javascript (현재 유일 지원) |
| code | String | ✓ | — | 실행할 코드 |

### 2.2 실행 컨텍스트

코드 내에서 사용 가능한 전역 객체:

| 객체 | 타입 | 설명 |
|------|------|------|
| `$input` | Object | 이전 노드의 출력 데이터 |
| `$vars` | Object | 워크플로우에서 선언된 변수 (읽기/쓰기) |
| `$execution` | Object | 실행 컨텍스트 (`id`, `startedAt`) |
| `$node` | Object | 현재 노드 메타데이터 (`id`, `label`) |

### 2.3 코드 작성 규칙

- `return` 문으로 출력 데이터를 반환해야 함
- `return`이 없으면 출력은 `null`
- 비동기 코드 지원: `async/await` 사용 가능
- 외부 네트워크 접근 불가 (샌드박싱)
- `require`/`import` 불가 (내장 유틸리티만 사용)

### 2.4 내장 유틸리티

| 유틸리티 | 설명 |
|----------|------|
| `$helpers.date(value)` | 날짜 파싱/포매팅 (dayjs 호환) |
| `$helpers.crypto.hash(algorithm, data)` | 해시 생성 (md5, sha256 등) |
| `$helpers.crypto.uuid()` | UUID v4 생성 |
| `$helpers.base64.encode(data)` | Base64 인코딩 |
| `$helpers.base64.decode(data)` | Base64 디코딩 |
| `console.log(...)` | 디버그 로그 (실행 로그에 기록) |

### 2.5 포트 정의

| 포트 | 방향 | 식별자 | 설명 |
|------|------|--------|------|
| Input | 입력 | `in` | 입력 데이터 |
| Output | 출력 | `out` | return 값 |

### 2.6 실행 로직

1. 입력 데이터를 `$input`에 바인딩
2. 워크플로우 변수를 `$vars`에 바인딩
3. 샌드박스 환경에서 코드 실행
4. `return` 값을 출력 포트로 전달
5. 에러 발생 시 스택 트레이스를 에러 정보에 포함

### 2.7 샌드박싱

노드 실행 샌드박싱 정책(spec/4-nodes/0-overview.md §5)을 동일하게 적용한다:

| 항목 | 제한 |
|------|------|
| 타임아웃 | 기본 30초 (노드 설정에서 변경 가능) |
| 메모리 | 최대 128MB |
| 네트워크 | 차단 (외부 호출은 Integration 노드 사용) |
| 파일 시스템 | 접근 불가 |
| 모듈 | require/import 불가, 내장 유틸리티만 사용 |

### 2.8 설정 UI — 코드 에디터

```
┌──────────────────────────────────────┐
│  Code Node                           │
│  Language: [JavaScript ▼]            │
│  ────────────────────────────────── │
│  ┌──────────────────────────────────┐│
│  │ 1│ // 입력 데이터 가공            ││
│  │ 2│ const items = $input.data;     ││
│  │ 3│                                ││
│  │ 4│ const result = items           ││
│  │ 5│   .filter(i => i.active)       ││
│  │ 6│   .map(i => ({                 ││
│  │ 7│     id: i.id,                  ││
│  │ 8│     name: i.name.trim(),       ││
│  │ 9│     score: i.score * 100       ││
│  │10│   }));                         ││
│  │11│                                ││
│  │12│ return { items: result };      ││
│  └──────────────────────────────────┘│
│                                      │
│  ─── Console Output ────────────── │
│  (마지막 실행 시 console.log 출력)   │
│                                      │
│  ─── Result Preview ────────────── │
│  { "items": [ { "id": 1, ... } ] }  │
└──────────────────────────────────────┘
```

- Monaco 스타일 코드 에디터 (구문 강조, 줄 번호, 자동완성)
- `$input`, `$vars`, `$helpers` 자동완성 지원
- 하단 Console Output: 마지막 실행의 `console.log` 출력 표시
- 하단 Result Preview: 마지막 실행의 return 값 JSON 표시
- 에러 발생 시 에디터 내 인라인 에러 표시 + 스택 트레이스
