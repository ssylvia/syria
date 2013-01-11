﻿define(
({
        "viewer": {
        	"main": {
                "scaleBarUnits": "metric"
            },
			"errors": {
                "createMap": "לא ניתן ליצור מפה",
                "general": "שגיאה",
                "bingError": "בפריסת האפליקציה הזו נדרש מפתח מפות ה- Bing שלך.",
                "noLegend": "אין מקרא.",
                "heatmap": "מיפוי צפיפויות לא נתמך בדפדפן זה.",
                "noText": "אנא הכנס מיקום לחיפוש.",
                "noLocation": "לא ניתן למצוא מיקום.",
                "integersOnly": "באפשרותך להכניס רק מספרים שלמים בשדה זה.",
				"nodesc": "אין תיאור."
            },
			"legend": {
				"menuTitle": "מקרא"
			},
            "search": {
            	"location": "מיקום",
            	"clearLocation": "נקה מיקום",
            	"placeholder": "מצא מקום"
            },
			"layers": {
				"menuTitle": "שכבות אופרטיביות"
			},
            "layer": {
            	"information": "מידע",
            	"transparency": "שקיפות",
            	"searchSettings": "הגדרות חיפוש",
            	"filteredBy": "סונן על ידי:"
            },
            "general": {
            	"at": "ב",
				"of": "מתוך",
            	"homeExtent": "טען תיחום מפה ברירת מחדל",
				"ok": "אישור",
				"close": "סגור"
            },
			"basemap": {
				"menuTitle": "בחר מפת בסיס",
			},
            "settings": {
            	"title": "הגדרות",
            	"searchAll": "חפש בכל",
            	"usingThisKeyword": "שימוש במיל(ו)ת מפתח",
            	"search": "חפש",
            	"fromThePast": "מהעבר",
            	"today": "יום",
            	"this_week": "שבוע",
            	"this_month": "חודש",
            	"all_time": "כל זמן",
            	"atLocation": "במיקום זה",
            	"centerOfMap": "מרכז המפה",
            	"centerOfMapTitle": "השתמש במרכז מפה",
            	"withinThisDistance": "במרחק זה",
            	"latitude": "רוחב:",
            	"longitude": "אורך:",
            	"locationText": "לחץ על המפה כדי לקבוע את המקור שלה",
            	"twSearch": "כיצד להשתמש בחיפוש טוויטר מתקדם"
            },
			"autoComplete": {
				"menuTitle": "תוצאות&hellip;"
			},
            "places": {
				"menuTitle": "מקומות מסומנים עם סימניות",
            	"places": "מיקומים",
            	"placesTitle": "מקומות סימניות",
            	"myLocation": "המיקום הנוכחי שלי",
            	"myLocationTitle": "מרכז מפה למיקום שלי"
            },
            "distanceSlider": {
            	"local": "מקומי",
            	"regional": "אזורי",
            	"national": "לאומי"
            },
            "about": {
            	"title": "אודות",
            	"access": "מגבלות גישה ושימוש"
            },
            "buttons": {
            	"legend": "מקרא",
            	"legendTitle": "הצג מקרא",
            	"basemap": "מפת בסיס",
            	"basemapTitle": "החלף מפת בסיס",
            	"layers": "שכבות",
            	"layersTitle": "למד על שכבות",
            	"social": "חברתי",
            	"socialTitle": "מדיה חברתית",
            	"link": "קישור",
            	"linkTitle": "שתף מפה מעוצבת זו.",
            	"about": "אודות",
            	"aboutTitle": "אודות מפה זו",
				"displayAs":"Display As",      
            	"point":"Points",
            	"cluster": "צברים",
            	"heatmap": "צפיפות"
            },
            "shareMenu": {
				"menuTitle": "שתף תצוגה נוכחית",
				"shareHeader": "שתף קישור למפה שלך",
            	"facebook": "פייסבוק",
            	"facebookHeader": "שתף בפייסבוק",
            	"twitter": "טוויטר",
            	"twitterHeader": "שתף בטוויטר",
            	"instructionHeader": "העתק/הדבק HTML לעמוד האינטרנט שלך",
            	"preview": "הצג והתאם"
            },
            "itemInfo": {
				"createdLabel": "נוצר",
				"ratingsLabel": "דירוג",
				"ratingsLabelPlural": "דירוגים",
				"viewsLabel": "תצוגה",
				"viewsLabelPlural": "תצוגות",
				"commentsLabel": "הערה",
				"commentsLabelPlural": "הערות",
				"modifiedLabel": "שונה לאחרונה",
				"by": "ע\"י",
				"separator": ","
			},
			"social": {
				"menuTitle": "שכבות מדיה חברתית"
			},
			"preview": {
				"minWidth": "רוחב מינימלי הוא",
				"minHeight": "גובה מינימלי הוא",
				"maxWidth": "רוחב מקסימלי הוא",
				"maxHeight": "גובה מקסימלי הוא",
				"customize": "התאמה אישית",
				"small": "קטן",
				"medium": "בינוני",
				"large": "גדול",
				"custom": "מותאם",
				"embed": "משובץ",
				"instruction": "העתק והדבק את ה- HTML הבא בכדי לשבץ את המפה באתר האינטרנט שלך."
			},
			"flickr": {
				"title": "Flickr",
				"description": "תמונות מפליקר"
			},
			"twitter": {
				"title": "טוויטר",
				"description": "ציוצים מתוך טוויטר"
			},
			"youtube": {
				"title": "יוטיוב",
				"description": "סרטון מתוך יוטיוב"
			},
			"panoramio":{
				"title":"Panoramio",                     
				"description":"Photos from Panoramio"    
			},
			"ushahidi":{
				"title":"Ushahidi",                     
				"description":"Incident reports from Ushahidi"    
			}
        }
    })
);